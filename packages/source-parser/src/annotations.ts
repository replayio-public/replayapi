/**
 * @param col 0-based column inside `line`.
 */
export function annotateLine(line: string, annotation: string, col: number): string {
  return line.slice(0, col) + `/*${annotation}*/` + line.slice(col);
}
