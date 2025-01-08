/**
 * @file Babel line and column numbers have the same indexing as Replay does: 1-based lines and 0-based columns.
 */

import { NodePath } from "@babel/traverse";

import { CodeLocRange } from "../util/codeLocUtil";

/**
 * NOTE: Babel does not export its `Position` type.
 */
export interface BabelPosition {
  line: number;
  column: number;
  index: number;
}

export function getNodeRange(path: NodePath): CodeLocRange {
  return {
    start: path.node.loc!.start.index,
    end: path.node.loc!.end.index,
  };
}

/**
 * Given a sorted array of NodePath, this returns a new array with any nested nodes removed.
 */
export function removeNestedPaths(paths: NodePath[]): NodePath[] {
  const result: NodePath[] = [];
  let lastParent: NodePath | null = null;

  for (const path of paths) {
    if (!lastParent || !path.isDescendant(lastParent)) {
      result.push(path);
      lastParent = path;
    }
  }
  return result;
}
