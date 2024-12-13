import { Frame, Location, PointDescription, PointStackFrame } from "@replayio/protocol";

export type IndexedPointStackFrame = PointStackFrame & { index: number };

export type FrameWithPoint = Frame & { point?: PointDescription };

/**
 * Line, source url, functionName and a string representing the code statement/expression surrounding some point.
 */
export type CodeAtLocation = {
  line: number;
  url: string;
  code: string;
  functionName?: string;
};

export type PointFunctionInfo = {
  name: string;
  lines: { start: number; end: number };
  params: string;
};

export type LocationWithUrl = Location & { url: string };
