/* Copyright 2020-2024 Record Replay Inc. */

import assert from "assert";

import { Node as BabelNode } from "@babel/types";
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
import { CodeAtLocation, StaticFunctionInfo } from "./types";
import { truncateAround } from "./util/truncateCenter";

const FailBabelParseSilently = process.env.NODE_ENV === "production";
const MaxNodeLength = 300;

// Query API:
//   * https://tree-sitter.github.io/tree-sitter/playground
//   * https://tree-sitter.github.io/tree-sitter/using-parsers#pattern-matching-with-queries
export default class SourceParser {
  readonly code: SourceContents;
  private readonly parser: Parser;
  private _babelParser: BabelParser | null = null;
  private _babelTriedParse = false;
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
    topNode: SyntaxNode,
    filter?: (n: SyntaxNode) => boolean
  ): SyntaxNode | null;

  getNodeAt(
    locOrNode: SyntaxNode | SourceLocation,
    topNodeOrFilter?: SyntaxNode | ((n: SyntaxNode) => boolean),
    filter?: (n: SyntaxNode) => boolean
  ): SyntaxNode | null {
    const topNode =
      topNodeOrFilter && "tree" in topNodeOrFilter ? topNodeOrFilter : this.tree.rootNode;
    filter = topNodeOrFilter && "tree" in topNodeOrFilter ? filter : topNodeOrFilter;
    if ("tree" in locOrNode) {
      // node = locOrNode;
      assert(
        topNode === this.tree.rootNode,
        "NYI: topNode must currently always be root if locOrNode is a node."
      );
      return locOrNode;
    }

    // 1. Try exact position:
    const treeSitterPoint = sourceLocationToTreeSitterPoint(locOrNode);
    let node = topNode.descendantForPosition(treeSitterPoint);

    if (!node) {
      // 2. If no exact match, scan the line, starting from column:
      let startPoint = { row: treeSitterPoint.row, column: treeSitterPoint.column };
      let endPoint = { row: treeSitterPoint.row, column: Number.MAX_SAFE_INTEGER };
      let nodesOnLine = topNode.descendantsOfType("*", startPoint, endPoint);
      if (!nodesOnLine.length && treeSitterPoint.column) {
        // 3. Scan before the column:
        startPoint = { row: treeSitterPoint.row, column: 0 };
        endPoint = { row: treeSitterPoint.row, column: treeSitterPoint.column + 1 };
        nodesOnLine = topNode.descendantsOfType("*", startPoint, endPoint);
      }
      if (nodesOnLine) {
        [node] = nodesOnLine;
      }
    }

    while (node) {
      if (!filter || filter(node)) {
        return node;
      }
      if (node === topNode) {
        // Don't go beyond the top node.
        return null;
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

  /**
   * Start at `loc` and find the first AST node containing it, whose type matches the regex.
   */
  getInnermostExpression(locOrNode: SyntaxNode | SourceLocation): SyntaxNode | null {
    return this.getInnermostNodeAt(locOrNode, this.language.expression);
  }

  getInnermostFunction(loc: SyntaxNode | SourceLocation): SyntaxNode | null {
    return this.getInnermostNodeAt(loc, this.language.function);
  }

  getInnermostStatementInFunction(loc: SyntaxNode | SourceLocation): SyntaxNode | null {
    const topNode = this.getInnermostFunction(loc) || this.tree.rootNode;
    return this.getNodeAt(loc, topNode, n => this.language.statement.has(n.type));
  }

  getOutermostExpressionInFunction(position: SyntaxNode | SourceLocation): SyntaxNode | null {
    const topNode = this.getInnermostFunction(position) || this.tree.rootNode;
    return this.getOuterMostTypeNode(position, "expression", topNode);
  }

  getRelevantContainingNodeAt(nodeOrLocation: SyntaxNode | SourceLocation): SyntaxNode | null {
    const statement = this.getInnermostStatementInFunction(nodeOrLocation);
    const expression = this.getOutermostExpressionInFunction(nodeOrLocation);
    // let node: SyntaxNode | null = null;
    // if (expression && statement) {
    //   // Get the inner-most node (which is the one with the bigger index).
    //   node = expression.startIndex > statement.startIndex ? expression : statement;
    // } else {
    //   node = expression || statement;
    // }
    return statement || expression;
  }

  /**
   * Find all functions within Node, that are not within another function.
   */
  getAllDirectlyNestedFunctions(node: SyntaxNode): SyntaxNode[] {
    const traverse = (node: SyntaxNode, insideFunction = false): SyntaxNode[] => {
      if (this.language.function.has(node.type)) {
        return insideFunction ? [] : [node];
      }
      return node.children.flatMap(child =>
        traverse(child, insideFunction || this.language.function.has(node.type))
      );
    };
    return traverse(node);
  }

  filterNodesInSameFunction(
    nodes: SyntaxNode[],
    fnNode: SyntaxNode = this.tree.rootNode
  ): SyntaxNode[] {
    const nestedFunctions = this.getAllDirectlyNestedFunctions(fnNode);
    return nodes.filter(n => {
      // Include all nodes inside `fnNode` itself.
      if (n.startIndex >= fnNode.startIndex || n.endIndex <= fnNode.endIndex) {
        // Exclude if `n` is nested in any nested function.
        return !nestedFunctions.some(
          fn => fn !== fnNode && n.startIndex >= fn.startIndex && n.endIndex <= fn.endIndex
        );
      }
      return false;
    });
  }

  getOuterMostTypeNode(
    loc: SyntaxNode | SourceLocation,
    queryType: string,
    topNode: SyntaxNode = this.tree.rootNode
  ): SyntaxNode | null {
    const positionNode = this.getNodeAt(loc);
    const query = `(${queryType}) @result`;
    const q = new Parser.Query(this.parser.getLanguage(), query);

    // Get the range of the node at position
    const targetStartIndex = positionNode.startIndex;
    const targetEndIndex = positionNode.endIndex;

    let largestContainer: SyntaxNode | null = null;

    for (const match of q.matches(topNode)) {
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
    return this.queryAllNodes(`(expression) @e`, node);
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
    return truncateAround(node.text, relativeIndex, MaxNodeLength);
  }

  // Add `pointAnnotation` to `node.text` at `targetLoc`.
  getAnnotatedNodeTextAt(
    nodeOrLocation: SyntaxNode | SourceLocation,
    pointAnnotation: string,
    targetLoc: SourceLocation | null = null,
    maxLines = 40
  ): [string, SourceLocation] | null {
    if (!targetLoc) {
      if ("line" in nodeOrLocation) {
        targetLoc = nodeOrLocation;
      } else {
        throw new Error("targetLoc is required if nodeOrLocation is not a location.");
      }
    }
    const node =
      "children" in nodeOrLocation
        ? nodeOrLocation
        : this.getRelevantContainingNodeAt(nodeOrLocation);
    if (!node) {
      throw new Error(`Node not found at ${JSON.stringify(nodeOrLocation)}`);
    }
    const startLoc = treeSitterPointToSourceLocation(node.startPosition);
    const relativeIndex = this.code.getRelativeIndex(targetLoc, startLoc);
    let text = node.text;

    const before = text.slice(0, relativeIndex);
    const after = text.slice(relativeIndex);
    let code = `${before}${pointAnnotation}${after}`;
    const source = new SourceContents("", code);
    if (source.rows.length > maxLines) {
      const targetLoc = source.indexToLocation(relativeIndex);
      const targetLineIndex = targetLoc.line - 1; // lines are 1-based
      const startLine = Math.max(targetLineIndex - Math.floor(maxLines / 2), 0);
      const endLine = Math.min(startLine + maxLines, source.rows.length - 1);
      code = source.rows.slice(startLine, endLine).join("\n");
    }

    return [code, startLoc];
  }

  /** ###########################################################################
   * Function info.
   * ##########################################################################*/

  getFunctionInfoAt(loc: SourceLocation): StaticFunctionInfo | null {
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
   * Heuristic subset of all "interesting" expression nodes within `node`, but not within or outside of nested functions.
   * @returns A list of nodes, but unique by text.
   */
  getInterestingInputDependenciesAt(nodeOrLocation: SyntaxNode | SourceLocation): SyntaxNode[] {
    const node = this.getRelevantContainingNodeAt(nodeOrLocation);
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

    // 2. Filter out expressions not at the same function or script level.
    expressions = this.filterNodesInSameFunction(
      expressions,
      this.getInnermostFunction(node) || this.tree.rootNode
    );

    // 3. Only pick the top-level expressions, including unwanted sub-trees.
    expressions = Array.from(
      new Set(
        expressions
          .map(
            e =>
              this.getOutermostExpressionInFunction(
                treeSitterPointToSourceLocation(e.startPosition)
              )!
          )
          // 2b. Remove expressions not fulfilling all constraints.
          .filter(e => !!e)
      )
    );

    // 4. Find all nested expressions but cull unwanted sub-trees.
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
    if (!this._babelTriedParse) {
      try {
        this._babelTriedParse = true;
        this._babelParser = babelParse(this.code);
      } catch (err: any) {
        if (FailBabelParseSilently) {
          console.error("Failed to parse with babel:", err.stack);
          this._babelParser = null;
        } else {
          throw err;
        }
      }
    }
    return this._babelParser;
  }

  private getBabelCodeAtLocation(bindingNode: BabelNode): CodeAtLocation {
    const bindingLoc = this.code.indexToLocation(bindingNode.start!);
    const bindingStatementText = this.getTruncatedNodeTextAt(bindingLoc) || "";
    const bindingFunction = this.getFunctionInfoAt(bindingLoc);

    return {
      line: bindingLoc.line,
      url: this.code.url,
      code: bindingStatementText,
      functionName: bindingFunction?.name,
    };
  }

  getBindingAt(loc: SourceLocation, expression: string): StaticBinding | null {
    const binding = this.babelParser?.getBindingAt(loc, expression);
    if (!binding) return null;

    let writes = binding.constantViolations.length
      ? binding.constantViolations.map(v => this.getBabelCodeAtLocation(v.node as BabelNode))
      : undefined;
    return {
      kind: binding.kind,
      // NOTE: We don't need declaration info for params, since those can be inferred from function and caller info.
      declaration:
        binding.kind !== "param"
          ? this.getBabelCodeAtLocation(binding.identifier as BabelNode)
          : undefined,
      writes,
    };
  }
}
