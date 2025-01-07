import {
  ExecutionPoint,
  Frame,
  Location,
  PointDescription,
  PointStackFrame,
} from "@replayio/protocol";
import { LineOfCode, StaticFunctionInfo } from "@replayio/source-parser/src/types";

export type IndexedPointStackFrame = PointStackFrame & { index: number };

export type FrameWithPoint = Frame & { point?: PointDescription };

export type LocationWithUrl = Location & { url: string };

export type LineOfCodeAtPoint = LineOfCode & {
  lastPoint: ExecutionPoint;
};

export type FunctionSkeleton = {
  firstLine: LineOfCodeAtPoint;
  branches: LineOfCodeAtPoint[];
  lastLine: LineOfCodeAtPoint;
};

export type PointFunctionInfo = StaticFunctionInfo & {
  functionSkeleton?: FunctionSkeleton;
};
