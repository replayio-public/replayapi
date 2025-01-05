/* Copyright 2020-2024 Record Replay Inc. */

import assert from "assert";

import { PointFunctionInfo } from "@replayio/data/src/recordingData/types";
import { ContentType, SourceLocation } from "@replayio/protocol";
import uniqBy from "lodash/uniqBy";
import Parser, { QueryMatch, SyntaxNode, Tree } from "tree-sitter";

import { BabelParser, babelParse } from "./babel/BabelParser";
import StaticScopes from "./bindings/StaticScopes";
import { guessFunctionName } from "./function-names";
import SourceContents from "./SourceContents";
import { StaticBinding } from "./StaticBindings";
import {
  sourceLocationToTreeSitterPoint,
  treeSitterPointToSourceLocation,
} from "./tree-sitter-locations";
import { LanguageInfo, TypeCover } from "./tree-sitter-nodes";
import { createTreeSitterParser } from "./tree-sitter-setup";
import { truncateAround } from "./util/truncateCenter";

// Query API:
//   * https://tree-sitter.github.io/tree-sitter/playground
//   * https://tree-sitter.github.io/tree-sitter/using-parsers#pattern-matching-with-queries
export default class SourceParser {
  readonly code: SourceContents;
  private readonly parser: Parser;
  private _babelParser: BabelParser | null = null;
  private _babelTriedParse: boolean = false;
  public readonly language: LanguageInfo;

  private _scopes: StaticScopes | null = null;
  private _tree: Tree | null = null;

  constructor(url: string, code: string, contentType?: ContentType) {
    this.code = new SourceContents(url, code);
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
    const treeSitterPoint = sourceLocationToTreeSitterPoint(locOrNode);
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

  getInnermostStatement(loc: SyntaxNode | SourceLocation): SyntaxNode | null {
    // NOTE: There is a `statement` supertype we can use for this instead.
    return this.getInnermostNodeAt(loc, this.language.statement);
  }

  getOutermostExpression(position: SyntaxNode | SourceLocation): SyntaxNode | null {
    return this.getOuterMostTypeNode(position, "expression");
  }

  getRelevantContainingNodeAt(loc: SyntaxNode | SourceLocation): SyntaxNode | null {
    const statement = this.getInnermostStatement(loc);
    const expression = this.getOutermostExpression(loc);

    return statement || expression;
  }

  getOuterMostTypeNode(loc: SyntaxNode | SourceLocation, queryType: string): SyntaxNode | null {
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

  queryExpressions(node = this.tree.rootNode): SyntaxNode[] {
    // Actual expressions.
    const expressions = this.queryAllNodes(`(expression) @e`, node);

    // // The actual expression inside jsx_expression is the 2nd child.
    // // const jsx_expressions = this.queryAllNodes(`(jsx_expression) @je`, node);

    // // Combine and deduplicate.
    // return uniqBy(
    //   expressions.concat(jsx_expressions.map(n => n.firstChild!.nextSibling!)),
    //   n => `${n.startIndex};;${n.endIndex}`
    // );
    return expressions;
  }

  /** ###########################################################################
   * Text + annotations.
   * ##########################################################################*/

  /**
   * Get the most descriptive text for code at `loc`.
   *
   * TODO: Consider better heuristics, especially as it pertains to locations inside declarations of large nodes, such as:
   * * function headers,
   * * if conditions,
   * * catch arguments
   * * Statements containing large expressions, e.g. inline functions etc.
   * and more...
   */
  getTruncatedNodeTextAt(loc: SourceLocation): string | null {
    const node = this.getRelevantContainingNodeAt(loc);
    if (!node) {
      return null;
    }
    const relativeIndex = this.code.getRelativeIndex(
      loc,
      treeSitterPointToSourceLocation(node.startPosition)
    );
    return truncateAround(node.text, relativeIndex);
  }

  getAnnotatedNodeTextAt(loc: SourceLocation, pointAnnotation: String): string | null {
    const node = this.getRelevantContainingNodeAt(loc);
    if (!node) {
      return null;
    }

    // Add `pointAnnotation` to `result.text` at `position`.
    const annotationIndex = this.code.getRelativeIndex(
      loc,
      treeSitterPointToSourceLocation(node.startPosition)
    );
    let text = node.text;

    const before = text.slice(0, annotationIndex);
    const after = text.slice(annotationIndex);

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
        start: treeSitterPointToSourceLocation(functionNode.startPosition).line,
        end: treeSitterPointToSourceLocation(functionNode.endPosition).line,
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
    const node = this.getOutermostExpression(nodeOrLocation) || this.getNodeAt(nodeOrLocation);
    if (!node) {
      return [];
    }

    // Don't traverse inline functions as they create new scopes.
    const excludeSubtree = this.language.function;

    // Ignore ArrayExpression, ObjectExpression, constants and some other noise.
    const excludeNode = this.language.typeCover([
      "array",
      "object",
      this.language.jsx,
      "parenthesized_expression",
      this.language.constant,
    ]);

    // 1. Find all expressions.
    //    NOTE: tsx parsing is immature at this point.
    let expressions = this.queryExpressions(node);
    // 2. Only pick the top-level expressions, including unwanted sub-trees.
    expressions = Array.from(
      new Set(
        expressions.map(
          e => this.getOutermostExpression(treeSitterPointToSourceLocation(e.startPosition))!
        )
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

  /** ###########################################################################
   * Babel, bindings.
   * ##########################################################################*/

  get babelParser(): BabelParser | null {
    if (!this._babelParser) {
      try {
        this._babelTriedParse = true;
        this._babelParser = babelParse(this.code);
      } catch (err: any) {
        console.error("Failed to parse with babel:", err.stack);
        this._babelParser = null;
      }
    }
    return this._babelParser;
  }

  getBindingAt(loc: SourceLocation, expression: string): StaticBinding | null {
    const binding = this.babelParser?.getBindingAt(loc, expression);
    if (!binding) return null;
    const bindingNode = binding.identifier;
    const bindingLoc = this.code.indexToLocation(bindingNode.start!);
    const bindingStatementText = this.getTruncatedNodeTextAt(bindingLoc) || "";
    const bindingFunction = this.getFunctionInfoAt(bindingLoc);
    return {
      kind: binding.kind,
      location: {
        line: bindingLoc.line,
        url: this.code.url,
        code: bindingStatementText,
        functionName: bindingFunction?.name || undefined,
      },
    };
  }
}
