
/**
 * Line, source url, functionName and a string representing the code statement/expression surrounding some point.
 */
export type CodeAtLocation = {
  line: number;
  url: string;
  code: string;
  functionName?: string;
};

export type StaticFunctionInfo = {
  name: string;
  lines: { start: number; end: number };
  params: string;
};

export type LineOfCode = {
  line: number;
  code: string;
}

export type StaticFunctionSkeleton = {
  firstLine: LineOfCode;
  lastLineAndReturns: LineOfCode[];
  branches: LineOfCode[];
};
