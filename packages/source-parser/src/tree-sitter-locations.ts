import { SourceLocation } from "graphql";
import { Point } from "tree-sitter";

/**
 * Convert Replay location to SourceParser Point. 
 * NOTE:
 *   * tree-sitter uses 0-based indexing for both line and column.
 *   * Replay uses 1-based indexing for both.
 */
export function sourceLocationToPoint(loc: SourceLocation): Point {
  return {
    row: loc.line - 1,
    column: loc.column - 1,
  };
}
