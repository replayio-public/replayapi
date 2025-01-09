import { ParserPlugin, parse } from "@babel/parser";
import traverse, { Binding, NodePath } from "@babel/traverse";
import NestedError from "@replayio/data/src/util/NestedError";
import { SourceLocation } from "@replayio/protocol";

import SourceContents from "../SourceContents";
import { removeNestedPaths } from "./babelLocations";

function getPluginsForSourceUrl(url: string | undefined) {
  const plugins: Array<ParserPlugin> = [
    "classProperties",
    "optionalChaining",
    "nullishCoalescingOperator",
  ];

  const [isTS /* isTSX */] = url?.match(/\.ts(x?)(\?.*)?$/) || [];
  if (isTS) {
    plugins.push("typescript");
    // NOTE: *.ts files also often contain JSX/TSX code.
    plugins.push("jsx");
  } else {
    plugins.push("flow", "jsx");
  }

  return plugins;
}

export type BabelAST = ReturnType<typeof parse>;

export function babelParse(code: SourceContents): BabelParser {
  const plugins = getPluginsForSourceUrl(code.url);

  let ast: BabelAST;
  try {
    ast = parse(code.contents, { plugins });
  } catch (e1: any) {
    try {
      ast = parse(code.contents, { plugins, sourceType: "module" });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_e2: any) {
      throw new NestedError(`babelParse failed, trying to parse as script and as module`, e1);
    }
  }
  return new BabelParser(code, ast);
}

// /**
//  * Returns whether the given binding is the binding of the given path.
//  */
// function isBound<T extends Node & { name: string }>(binding: Binding, path: NodePath<T>) {
//   return binding.identifier === path.node.name || binding.referencePaths.includes(path);
// }

export class BabelParser {
  constructor(
    public readonly code: SourceContents,
    private readonly ast: BabelAST
  ) {}

  /**
   * Get the binding of a name at given path.
   */
  getPathBinding(path: NodePath, name: string): Binding | null {
    // for reference: https://github.com/babel/babel/blob/672a58660f0b15691c44582f1f3fdcdac0fa0d2f/packages/babel-traverse/src/scope/index.ts#L215
    let binding: Binding | null = null;

    let { scope } = path;
    let lastScope = scope;

    while (
      scope &&
      (binding = scope.getBinding(name) || null) &&
      !binding
      // NOTEs:
      // * We cannot perform the `isBound` check since we don't necessarily have an exact `identifier` path.
      // * But omitting the check might lead to false positives, e.g. in case of nested vars.
      // * Example: `var x = 1; { console.log("FALSE POSITIVE", x); var x = 2; console.log("CORRECT BINDING", x); }`
      /* && !isBound(binding, name) */
    ) {
      lastScope = scope;
      scope = scope.parent;
    }

    binding = binding || lastScope.getBinding(name) || null;

    return binding;
  }

  getBindingAt(loc: SourceLocation, name: string): Binding | null {
    const path = this.getInnermostNodePathAt(loc);
    if (path) {
      return this.getPathBinding(path, name);
    }
    return null;
  }

  private assertTypeOrAliasExist(...babelTypeOrAliases: string[]) {
    if (
      babelTypeOrAliases &&
      // Little trick: NodePath prototype has a check for each type or alias.
      !babelTypeOrAliases.some(t => (NodePath.prototype as any)["is" + t])
    ) {
      throw new Error(`Invalid babelTypeOrAlias: ${babelTypeOrAliases}`);
    }
  }

  getInnermostNodePathAt(loc: SourceLocation, ...babelTypeOrAliases: string[]): NodePath | null {
    this.assertTypeOrAliasExist(...babelTypeOrAliases);

    const targetOffset = this.code.locationToIndex(loc);
    let matchingPath: NodePath | null = null;
    let innerMostSize = Infinity;

    traverse(this.ast, {
      enter(path: NodePath) {
        const node = path.node;
        if (!node.start || !node.end) {
          return;
        }
        if (babelTypeOrAliases && !babelTypeOrAliases.some(t => path.isNodeType(t))) {
          return;
        }

        // Check if the location is within this node's bounds using character offsets
        if (node.start <= targetOffset && node.end >= targetOffset) {
          const nodeSize = node.end - node.start;

          // Update the matching node if this one is smaller (more specific)
          if (nodeSize < innerMostSize) {
            matchingPath = path;
            innerMostSize = nodeSize;
          }
        }
      },
    });

    return matchingPath;
  }

  getMatchingNodesWithin(path: NodePath, babelTypeOrAliases: string[]): NodePath[] {
    if (!babelTypeOrAliases.length) {
      throw new Error(`babelTypeOrAliases missing`);
    }
    this.assertTypeOrAliasExist(...babelTypeOrAliases);

    // 1. Find all matching nodes.
    const matchingPaths: NodePath[] = [];
    traverse(path.node, {
      enter(innerPath: NodePath) {
        if (babelTypeOrAliases.some(t => innerPath.is(t))) {
          matchingPaths.push(innerPath);
        }
      },
    });

    // 2. Remove nested nodes.
    return removeNestedPaths(matchingPaths);
  }

  getAllBlockParentsWithin(path: NodePath): NodePath[] {
    // NOTE: IfStatement not being part of the BlockParent cover must be a babel-types bug.
    return this.getMatchingNodesWithin(path, ["BlockParent", "IfStatement"]);
  }

  getAllBlockParentsInFunctionAt(loc: SourceLocation): NodePath[] {
    const functionPath = this.getInnermostNodePathAt(loc, "Function");
    return functionPath ? this.getAllBlockParentsWithin(functionPath) : [];
  }

  // getFunctionSkeletonAt(loc: SourceLocation): StaticFunctionSkeleton | null {
  //   const functionPath = this.getInnermostNodePathAt(loc, "Function");
  //   return this.getMatchingNodesWithin(functionPath, ["CompletionStatement", "CallExpression", ""]);
  // }

  
}
