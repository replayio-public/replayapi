/* Copyright 2020-2024 Record Replay Inc. */

import assert from "assert";

import { PointFunctionInfo } from "@replay/data/src/recording-data/types";
import { ContentType, SourceLocation } from "@replayio/protocol";
import Parser, { QueryMatch, SyntaxNode } from "tree-sitter";

import { guessFunctionName } from "./display-names";
import SourceContents from "./SourceContents";
import { pointToSourceLocation, sourceLocationToPoint } from "./tree-sitter-locations";
import { createTreeSitterParser } from "./tree-sitter-setup";

// https://tree-sitter.github.io/tree-sitter/playground
// https://tree-sitter.github.io/tree-sitter/using-parsers#pattern-matching-with-queries
// Grammar definitions:
//    * https://github.com/tree-sitter/tree-sitter-javascript/blob/master/src/grammar.json
//    * https://github.com/tree-sitter/tree-sitter-typescript/blob/master/common/define-grammar.js#L3
//    * Node Types (includes supertypes): https://github.com/tree-sitter/tree-sitter-javascript/blob/master/src/node-types.json
//    * https://github.com/tree-sitter/tree-sitter-python/blob/master/grammar.js#L354
// # Concepts
// * [Supertype Nodes](https://tree-sitter.github.io/tree-sitter/using-parsers#supertype-nodes)
//   * https://github.com/tree-sitter/tree-sitter-javascript/blob/master/src/grammar.json#L6924
//   * https://github.com/tree-sitter/tree-sitter-typescript/blob/master/common/define-grammar.js#L12
//   * https://github.com/tree-sitter/tree-sitter-python/blob/master/grammar.js#L60
export default class SourceParser {
  private parser: Parser;
  private _tree: Parser.Tree | null = null;
  public readonly code: SourceContents;
  constructor(url: string, code: string, contentType?: ContentType) {
    this.code = new SourceContents(code);
    this.parser = createTreeSitterParser(url, contentType);
  }

  get tree(): Parser.Tree {
    assert(this._tree, "Tree is not initialized. Call parse first.");
    return this._tree;
  }

  parse(): void {
    this._tree = this.parser.parse(this.code.contents);
  }

  /** ###########################################################################
   * Finding nearby nodes at location.
   * ##########################################################################*/

  getDescendantAtPosition(loc: SourceLocation): SyntaxNode {
    return this.tree.rootNode.descendantForPosition(sourceLocationToPoint(loc));
  }

  /**
   * Start at `loc` and find the first AST node containing it, whose type matches the regex.
   */
  getInnermostNodeAt(loc: SourceLocation, typeRegex: RegExp): SyntaxNode | null {
    let node = this.getDescendantAtPosition(loc);
    while (node) {
      if (node.type.match(typeRegex)) {
        return node;
      }
      node = node.parent!;
    }
    return null;
  }

  getInnermostFunction(loc: SourceLocation): SyntaxNode | null {
    return this.getInnermostNodeAt(loc, /function|method/);
  }

  getInnermostStatement(loc: SourceLocation): SyntaxNode | null {
    // NOTE: There is a `statement` supertype we can use for this instead.
    return this.getInnermostNodeAt(loc, /statement|decl/);
  }

  getOutermostExpression(position: SourceLocation): SyntaxNode | null {
    return this.getOuterMostTypeNode(position, "expression");
  }

  getRelevantContainingNodeAt(loc: SourceLocation): SyntaxNode | null {
    const statement = this.getInnermostStatement(loc);
    const expression = this.getOutermostExpression(loc);

    return statement || expression;
  }

  getOuterMostTypeNode(loc: SourceLocation, cover: string): SyntaxNode | null {
    const root = this.tree.rootNode;
    const positionNode = this.getDescendantAtPosition(loc);
    const query = `(${cover}) @result`;
    const q = new Parser.Query(this.parser.getLanguage(), query);

    // Get the range of the node at position
    const targetStartPosition = positionNode.startPosition;
    const targetEndPosition = positionNode.endPosition;

    let largestContainer: SyntaxNode | null = null;

    for (const match of q.matches(root)) {
      const node = match.captures[0].node;
      // Check if this node's range fully contains our target node's range
      if (
        node.startPosition.row <= targetStartPosition.row &&
        node.endPosition.row >= targetEndPosition.row &&
        (node.startPosition.row < targetStartPosition.row ||
          node.startPosition.column <= targetStartPosition.column) &&
        (node.endPosition.row > targetEndPosition.row ||
          node.endPosition.column >= targetEndPosition.column)
      ) {
        // Update if this is the first match or if it has a larger range than current best
        if (
          !largestContainer ||
          node.startPosition.row < largestContainer.startPosition.row ||
          (node.startPosition.row === largestContainer.startPosition.row &&
            node.startPosition.column < largestContainer.startPosition.column)
        ) {
          largestContainer = node;
        }
      }
    }

    return largestContainer;
  }

  /** ###########################################################################
   * Query all matching nodes.
   * ##########################################################################*/

  /**
   * Run an arbitrary query and return all matches.
   */
  queryAll(query: string): QueryMatch[] {
    const root = this.tree.rootNode;
    const q = new Parser.Query(this.parser.getLanguage(), query);
    return q.matches(root);
  }

  /**
   * Run an arbitrary query and return all nodes of all matches.
   */
  queryAllNodes(query: string): SyntaxNode[] {
    const root = this.tree.rootNode;
    const q = new Parser.Query(this.parser.getLanguage(), query);
    return q.matches(root)?.flatMap(m => m?.captures.map(c => c.node) || []) || [];
  }

  /**
   * Find the first matching node of every match in `query`.
   */
  captureAllOnce(query: string): SyntaxNode[] {
    return this.queryAll(query)
      .map(match => match.captures?.[0]?.node || null)
      .filter(Boolean);
  }

  /** ###########################################################################
   * Annotations.
   * ##########################################################################*/

  getAnnotatedNodeTextAt(loc: SourceLocation, pointAnnotation: String): string | null {
    const result = this.getRelevantContainingNodeAt(loc);
    if (!result) {
      return null;
    }

    // Add `pointAnnotation` to `result.text` at `position`.
    const annotationIndex = this.code.locationToIndex(loc);
    let text = result.text;

    const start = result.startIndex;
    const before = text.slice(0, annotationIndex - start);
    const after = text.slice(annotationIndex - start);

    return `${before}${pointAnnotation}${after}`;
  }

  /** ###########################################################################
   * FunctionInfo.
   * ##########################################################################*/

  getFunctionInfoAt(loc: SourceLocation): PointFunctionInfo | null {
    const functionNode = this.getInnermostFunction(loc);
    if (!functionNode) {
      return null;
    }
    const name = guessFunctionName(functionNode);
    return {
      name: name || "",
      lines: {
        start: pointToSourceLocation(functionNode.startPosition).line,
        end: pointToSourceLocation(functionNode.endPosition).line,
      },
      params: functionNode.childForFieldName("parameters")?.text || "",
    };
  }
}
