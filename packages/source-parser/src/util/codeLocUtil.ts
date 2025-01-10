export interface CodeLocRange {
  start: number;
  end: number;
}

export function isRangeContained(inner: CodeLocRange, outer: CodeLocRange): boolean {
  return inner.start >= outer.start && inner.end <= outer.end;
}

export function isLocContained(index: number, outer: CodeLocRange): boolean {
  return index >= outer.start && index <= outer.end;
}

