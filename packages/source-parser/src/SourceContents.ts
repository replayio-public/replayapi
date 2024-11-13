import { SourceLocation } from "@replayio/protocol";
import { Point } from "tree-sitter";
import { sourceLocationToPoint } from "./tree-sitter-locations";

export default class SourceContents {
  rows: string[] = [];
  constructor(
    public readonly contents: string
  ) {
    this.rows = contents.split("\n");
  }

  locationToIndex(loc: SourceLocation): number {
    return this.pointToIndex(sourceLocationToPoint(loc))
  }
  
  pointToIndex(point: Point): number {
    let index = 0;

    // Count all lines.
    for (let i = 0; i < point.row; i++) {
        index += this.rows[i].length + 1; // +1 for the newline character
    }
  
    // Add the column offset at the end.
    index += point.column;
    
    return index;
  }
}
