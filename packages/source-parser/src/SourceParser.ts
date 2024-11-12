/* Copyright 2020-2024 Record Replay Inc. */

import { ContentType } from "@replayio/protocol";
import Parser, { SyntaxNode } from "tree-sitter";

import { createTreeSitterParser } from "./tree-sitter-setup";
import assert from "assert";

export default class SourceParser {
  private parser: Parser;
  private _tree: Parser.Tree | null = null;
  constructor(url: string, contentType?: ContentType) {
    this.parser = createTreeSitterParser(url, contentType);
  }

  parse(code: string): void {
    this._tree = this.parser.parse(code);
  }

  get tree(): Parser.Tree {
    assert(this._tree, "Tree is not initialized. Call parse first.");
    return this._tree;
  }

  getInnermostStatement(
    position: { row: number; column: number }
  ): SyntaxNode | null {
    let node = this.tree.rootNode.descendantForPosition(position);

    while (node) {
      if (node.type.includes("statement") || node.type.includes("decl")) {
        return node;
      }
      node = node.parent!;
    }
    return null;
  }

  getOutermostExpression(
    position: { row: number; column: number }
  ): SyntaxNode | null {
    return this.getOuterMostCoverNode(position, "expression");
  }

  getRelevantContainingNodeAt(
    position: { row: number; column: number }
  ): SyntaxNode | null {
    const statement = this.getInnermostStatement(position);
    const expression = this.getOutermostExpression(position);

    if (!statement) return expression;
    if (!expression) return statement;

    const statementSize = statement.endIndex - statement.startIndex;
    const expressionSize = expression.endIndex - expression.startIndex;

    return expressionSize > statementSize ? expression : statement;
  }

  getOuterMostCoverNode(position: { row: number; column: number }, cover: string): SyntaxNode | null {
    const root = this.tree.rootNode;
    const positionNode = root.descendantForPosition(position);
    const query = `(${cover}) @result`;
    const q = new Parser.Query(this.parser.getLanguage(), query);
    
    // Get the range of the node at position
    const targetStartPosition = positionNode.startPosition;
    const targetEndPosition = positionNode.endPosition;
    
    let largestContainer: SyntaxNode | null = null;
    
    for (const match of q.matches(root)) {
      const node = match.captures[0].node;
      // Check if this node's range fully contains our target node's range
      if (node.startPosition.row <= targetStartPosition.row &&
          node.endPosition.row >= targetEndPosition.row &&
          (node.startPosition.row < targetStartPosition.row || 
           node.startPosition.column <= targetStartPosition.column) &&
          (node.endPosition.row > targetEndPosition.row || 
           node.endPosition.column >= targetEndPosition.column)) {
        
        // Update if this is the first match or if it has a larger range than current best
        if (!largestContainer || 
            node.startPosition.row < largestContainer.startPosition.row ||
            (node.startPosition.row === largestContainer.startPosition.row && 
             node.startPosition.column < largestContainer.startPosition.column)) {
          largestContainer = node;
        }
      }
    }
    
    return largestContainer;
  }
}

if (require.main === module) {
  // Run a quick test.
  const parser = new SourceParser("test.ts");
  parser.parse(`function foo() {
    return f(x, g("hello123qwesdfjnlsdfksjdnlsdgndf", 123));
  }`);
  console.log(parser.getInnermostStatement({ row: 1, column: 40 }));
  console.log(parser.getOutermostExpression({ row: 1, column: 40 }));
}
