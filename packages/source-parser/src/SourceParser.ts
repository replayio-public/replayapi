/* Copyright 2020-2024 Record Replay Inc. */

import assert from "assert";

import { ContentType, SourceLocation } from "@replayio/protocol";
import Parser, { SyntaxNode } from "tree-sitter";

import SourceContents from "./SourceContents";
import { sourceLocationToPoint } from "./tree-sitter-locations";
import { createTreeSitterParser } from "./tree-sitter-setup";

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
   * Basic parsing methods.
   * ##########################################################################*/

  getDescendantAtPosition(loc: SourceLocation): SyntaxNode {
    return this.tree.rootNode.descendantForPosition(sourceLocationToPoint(loc));
  }

  getInnermostStatement(loc: SourceLocation): SyntaxNode | null {
    let node = this.getDescendantAtPosition(loc);

    while (node) {
      if (node.type.includes("statement") || node.type.includes("decl")) {
        return node;
      }
      node = node.parent!;
    }
    return null;
  }

  getOutermostExpression(position: SourceLocation): SyntaxNode | null {
    return this.getOuterMostCoverNode(position, "expression");
  }

  getRelevantContainingNodeAt(loc: SourceLocation): SyntaxNode | null {
    const statement = this.getInnermostStatement(loc);
    const expression = this.getOutermostExpression(loc);

    let result = statement || expression;
    if (!result) {
      return null;
    }

    if (statement && expression) {
      const statementSize = statement.endIndex - statement.startIndex;
      const expressionSize = expression.endIndex - expression.startIndex;

      result = expressionSize > statementSize ? expression : statement;
    }

    return result;
  }

  /** ###########################################################################
   * Cover nodes.
   * ##########################################################################*/

  getOuterMostCoverNode(loc: SourceLocation, cover: string): SyntaxNode | null {
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
}

if (require.main === module) {
  // Run a quick test.
  const code = `function foo() {
    return f(x, g("hello123qweSdfjnlsdfksjdnlsdgndf", 123));
  }`;
  const parser = new SourceParser("test.ts", code);
  parser.parse();
  console.log(
    `Outermost expression.\n  Expected: f(...))\n    Actual:`,
    parser.getOutermostExpression({ line: 2, column: 31 })!.text
  );
  console.log(
    `Innermost statement.\n  Expected: return f(...))\n    Actual:`,
    parser.getInnermostStatement({ line: 2, column: 5 })!.text
  );
  console.log(parser.getAnnotatedNodeTextAt({ line: 2, column: 5 }, "/*BREAK*/"));
  console.log(parser.getAnnotatedNodeTextAt({ line: 2, column: 31 }, "/*BREAK*/"));
}
