import { SourceLocation } from "graphql";
import { Point } from "tree-sitter";

/**
 * Convert Replay location to SourceParser Point. 
 * NOTE:
 *   * tree-sitter has 0-based lines and columns.
 *   * Replay has 1-based lines and 0-based columns.
 */
export function sourceLocationToPoint(loc: SourceLocation): Point {
  return {
    row: loc.line - 1,
    column: loc.column,
  };
}
