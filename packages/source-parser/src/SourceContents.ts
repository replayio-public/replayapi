import { SourceLocation } from "@replayio/protocol";

export default class SourceContents {
  rows: string[] = [];
  constructor(
    public readonly url: string,
    public readonly contents: string
  ) {
    this.rows = contents.split("\n");
  }

  getRelativeIndex(loc: SourceLocation, startLocation: SourceLocation): number {
    const startIndex = this.locationToIndex(startLocation);
    const locIndex = this.locationToIndex(loc);
    return locIndex - startIndex;
  }

  locationToIndex(loc: SourceLocation): number {
    // Adjust for 1-indexed line numbers
    const lineIndex = loc.line - 1;

    if (lineIndex < 0 || lineIndex >= this.rows.length) {
      throw new Error(`Invalid line number: ${loc.line}`);
    }

    let index = 0;

    // Count characters in previous lines
    for (let i = 0; i < lineIndex; i++) {
      index += this.rows[i].length + 1; // +1 for newline
    }

    // Add the column offset
    index += loc.column;

    return index;
  }

  indexToLocation(index: number): SourceLocation {
    if (index < 0 || index > this.contents.length) {
      throw new Error(`Invalid index: ${index}`);
    }

    let remainingChars = index;
    let line = 1;

    for (const row of this.rows) {
      const rowLength = row.length + 1; // +1 for newline
      if (remainingChars < rowLength) {
        return { line, column: remainingChars };
      }
      remainingChars -= rowLength;
      line++;
    }

    // Handle end of file
    return { line: this.rows.length, column: this.rows[this.rows.length - 1].length };
  }
}
