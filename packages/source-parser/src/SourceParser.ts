/* Copyright 2020-2024 Record Replay Inc. */

import assert from "assert";

import { PointFunctionInfo } from "@replayio/data/src/recordingData/types";
import { ContentType, SourceLocation } from "@replayio/protocol";
import uniqBy from "lodash/uniqBy";
import Parser, { QueryMatch, SyntaxNode, Tree } from "tree-sitter";

import StaticScopes from "./bindings/StaticScopes";
import { guessFunctionName } from "./function-names";
import SourceContents from "./SourceContents";
import { pointToSourceLocation, sourceLocationToPoint } from "./tree-sitter-locations";
import { LanguageInfo, TypeCover } from "./tree-sitter-nodes";
import { createTreeSitterParser } from "./tree-sitter-setup";

// Query API:
//   * https://tree-sitter.github.io/tree-sitter/playground
//   * https://tree-sitter.github.io/tree-sitter/using-parsers#pattern-matching-with-queries
export default class SourceParser {
  readonly code: SourceContents;
  private readonly parser: Parser;
  public readonly language: LanguageInfo;

  private _scopes: StaticScopes | null = null;
  private _tree: Tree | null = null;

  constructor(url: string, code: string, contentType?: ContentType) {
    this.code = new SourceContents(code);
    this.parser = createTreeSitterParser(url, contentType);
    this.language = new LanguageInfo(this.parser);
  }

  get tree(): Tree {
    assert(this._tree, "Tree is not initialized. Call parse first.");
    return this._tree;
  }

  get scopes(): StaticScopes {
    assert(this._scopes, "Bindings are not initialized. Call parse first.");
    return this._scopes;
  }

  parse(): void {
    this._tree = this.parser.parse(this.code.contents);
    this._scopes = new StaticScopes(this);
    this._scopes._parse();
  }

  /** ###########################################################################
   * Finding nearby nodes at location.
   * ##########################################################################*/

  getNodeAt(locOrNode: SyntaxNode | SourceLocation): SyntaxNode;
  getNodeAt(
    locOrNode: SyntaxNode | SourceLocation,
    filter?: (n: SyntaxNode) => boolean
  ): SyntaxNode | null;

  getNodeAt(
    locOrNode: SyntaxNode | SourceLocation,
    filter?: (n: SyntaxNode) => boolean
  ): SyntaxNode | null {
    if ("tree" in locOrNode) {
      return locOrNode;
    }

    // 1. Try exact position:
    const treeSitterPoint = sourceLocationToPoint(locOrNode);
    let node = this.tree.rootNode.descendantForPosition(treeSitterPoint);

    if (!node) {
      // 2. If no exact match, scan the line, starting from column:
      let startPoint = { row: treeSitterPoint.row, column: treeSitterPoint.column };
      let endPoint = { row: treeSitterPoint.row, column: Number.MAX_SAFE_INTEGER };
      let nodesOnLine = this.tree.rootNode.descendantsOfType("*", startPoint, endPoint);
      if (!nodesOnLine.length && treeSitterPoint.column) {
        // 3. Scan before the column:
        startPoint = { row: treeSitterPoint.row, column: 0 };
        endPoint = { row: treeSitterPoint.row, column: treeSitterPoint.column + 1 };
        nodesOnLine = this.tree.rootNode.descendantsOfType("*", startPoint, endPoint);
      }
      if (nodesOnLine) {
        [node] = nodesOnLine;
      }
    }

    while (node) {
      if (!filter || filter(node)) {
        return node;
      }
      node = node.parent!;
    }
    return null;
  }

  /**
   * Start at `loc` and find the first AST node containing it, whose type matches the regex.
   */
  getInnermostNodeAt(locOrNode: SyntaxNode | SourceLocation, type: TypeCover): SyntaxNode | null {
    return this.getNodeAt(locOrNode, n => type.has(n.type));
  }

  getInnermostFunction(loc: SourceLocation): SyntaxNode | null {
    return this.getInnermostNodeAt(loc, this.language.function);
  }

  getInnermostStatement(loc: SourceLocation): SyntaxNode | null {
    // NOTE: There is a `statement` supertype we can use for this instead.
    return this.getInnermostNodeAt(loc, this.language.statement);
  }

  getOutermostExpression(position: SourceLocation): SyntaxNode | null {
    return this.getOuterMostTypeNode(position, "expression");
  }

  getRelevantContainingNodeAt(loc: SourceLocation): SyntaxNode | null {
    const statement = this.getInnermostStatement(loc);
    const expression = this.getOutermostExpression(loc);

    return statement || expression;
  }

  getOuterMostTypeNode(loc: SourceLocation, queryType: string): SyntaxNode | null {
    const root = this.tree.rootNode;
    const positionNode = this.getNodeAt(loc);
    const query = `(${queryType}) @result`;
    const q = new Parser.Query(this.parser.getLanguage(), query);

    // Get the range of the node at position
    const targetStartIndex = positionNode.startIndex;
    const targetEndIndex = positionNode.endIndex;

    let largestContainer: SyntaxNode | null = null;

    for (const match of q.matches(root)) {
      const node = match.captures[0].node;
      const containsTarget = node.startIndex <= targetStartIndex && node.endIndex >= targetEndIndex;

      if (containsTarget && (!largestContainer || node.startIndex < largestContainer.startIndex)) {
        largestContainer = node;
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
  queryAll(query: string, root = this.tree.rootNode): QueryMatch[] {
    const q = new Parser.Query(this.parser.getLanguage(), query);
    return q.matches(root);
  }

  /**
   * Run an arbitrary query and return all nodes of all matches.
   */
  queryAllNodes(query: string, root = this.tree.rootNode): SyntaxNode[] {
    return this.queryAll(query, root)?.flatMap(m => m?.captures.map(c => c.node) || []) || [];
  }

  /**
   * Find the first matching node of every match in `query`.
   */
  captureAllOnce(query: string, root = this.tree.rootNode): SyntaxNode[] {
    return this.queryAll(query, root)
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
   * Function info.
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

  /** ###########################################################################
   * Input dependencies.
   * ##########################################################################*/

  /**
   * Heuristic subset of all "interesting" expression nodes within `node`.
   * @returns A list of nodes, but unique by text.
   */
  getInterestingInputDependencies(nodeOrLocation: SyntaxNode | SourceLocation): SyntaxNode[] {
    const node = this.getNodeAt(nodeOrLocation);

    // Don't traverse inline functions as they create new scopes.
    const excludeSubtree = this.language.function;

    // Ignore ArrayExpression and ObjectExpression nodes.
    const excludeNode = this.language.typeCover(["array", "object"]);

    // 1. Find all expressions.
    let expressions = this.queryAllNodes("(expression) @expr", node);
    // 2. Only pick the top-level expressions, including unwanted sub-trees.
    expressions = Array.from(
      new Set(
        expressions.map(e => this.getOutermostExpression(pointToSourceLocation(e.startPosition))!)
      )
    );
    // 3. Find all nested expressions but cull unwanted sub-trees.
    const nodes: SyntaxNode[] = [];
    for (const expr of expressions) {
      const traverse = (node: SyntaxNode) => {
        if (!excludeSubtree.has(node)) {
          if (this.language.expression.has(node) && !excludeNode.has(node)) {
            nodes.push(node);
          }
          for (let child = node.firstChild; child !== null; child = child.nextSibling) {
            traverse(child);
          }
        }
      };
      traverse(expr);
    }
    return uniqBy(nodes, n => n.text);
  }
}
