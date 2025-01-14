import {
  Result as EvaluationResult,
  ExecutionPoint,
  Frame,
  Location,
  PointDescription,
  PointStackFrame,
  SourceLocation,
} from "@replayio/protocol";
import { StaticBinding } from "@replayio/source-parser/src/StaticBindings";
import { CodeAtLocation, LineOfCode, StaticFunctionInfo } from "@replayio/source-parser/src/types";

import { RichStackFrame } from "./DependencyChain";

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

export interface InputDependency extends ExpressionAnalysisResult {
  expression: string;
}

export interface CodeAtPoint extends CodeAtLocation {
  point: ExecutionPoint;
}

export interface DataFlowOrigin {
  point?: ExecutionPoint;
  kind?: string;
  location?: CodeAtLocation;
  explanation?: string;
}

export interface ExpressionDataFlowResult {
  staticBinding?: StaticBinding;
  origins?: DataFlowOrigin[];
  objectCreationSite?: DataFlowOrigin;
}

export interface SimpleValuePreview {
  value?: string;
  type?: string;
}

export type SimpleValuePreviewResult = SimpleValuePreview | null;

export interface ExpressionAnalysisResult extends SimpleValuePreview, ExpressionDataFlowResult {
  expression: string;
  explanation?: string;
}

export interface InspectPointResult {
  location: CodeAtLocation;
  function: PointFunctionInfo | null;
  inputDependencies: any; // TODO: Replace with proper type once implemented
  stackAndEvents: RichStackFrame[];
  stackAndEventsTruncated?: boolean;
}

export type InspectDataResult = InspectPointResult & ExpressionAnalysisResult;

export type EvaluateResult = {
  exception: EvaluationResult["exception"] | null;
  returned: EvaluationResult["returned"] | null;
};

export type SummarizedCodeAtPoint =
  | CodeAtPoint
  | {
      summarizedCode: string;
    }
  | {
      reference: string;
    }
  | {
      omitted: string;
    };

export type NeighboringCodeSummary = {
  statements: SummarizedCodeAtPoint[];
};

export type FrameStep = SourceLocation & {
  /** 1-dimensional index into the source code. */
  index: number;
  point: ExecutionPoint;

  // TODO: add a FrameStep type to distinguish between:
  //   * DecisionStep
  //   * CallStep
  //   * ReturnStep
  //   * CompletionStep (return, break, continue)
  //   * etc.
};
export type UniqueFrameStep = FrameStep & { hits: number };
