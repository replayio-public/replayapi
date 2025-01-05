/**
 * @file Babel line and column numbers have the same indexing as Replay does: 1-based lines and 0-based columns.
 */

/**
 * NOTE: Babel does not export its `Position` type.
 */
export interface BabelPosition {
  line: number;
  column: number;
  index: number;
}
