import { SourceLocation } from "graphql";
import { Point } from "tree-sitter";

/**
 * Convert Replay location to tree-sitter Point.
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
/**
 * Convert tree-sitter Point to Replay location.
 * NOTE:
 *   * tree-sitter has 0-based lines and columns.
 *   * Replay has 1-based lines and 0-based columns.
 */
export function pointToSourceLocation(point: Point): SourceLocation {
  return {
    line: point.row + 1,
    column: point.column,
  };
}
