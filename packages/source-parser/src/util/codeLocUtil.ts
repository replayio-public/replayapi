export interface CodeLocRange {
  start: number;
  end: number;
}

export function isLocNested(inner: CodeLocRange, outer: CodeLocRange): boolean {
  return inner.start >= outer.start && inner.end <= outer.end;
}

