/* Copyright 2020-2024 Record Replay Inc. */
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

export type HasPoint = { point: ExecutionPoint };
export type MaybeHasPoint = { point?: ExecutionPoint };

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

export type CodeAtPoint = HasPoint & CodeAtLocation;

export interface DependencyEventNode extends MaybeHasPoint, Partial<CodeAtLocation> {
  // Sometimes, we only have a single point for multiple dependency events.
  kind?: string | string[];
  inputs?: string[];
  expression?: string;
  value?: SimpleValuePreview;
  explanation?: string;
  children?: DependencyEventNode[];
}

export interface ExpressionDependencyResult {
  staticBinding?: StaticBinding;
  dependencyChain?: DependencyEventNode[];
  objectCreationSite?: DependencyEventNode;
}

export interface SimpleValuePreview {
  value?: string;
  type?: string;
}

export type SimpleValuePreviewResult = SimpleValuePreview | null;

export interface ExpressionAnalysisResult extends SimpleValuePreview, ExpressionDependencyResult {
  expression: string;
  explanation?: string;
}

export interface InspectPointResult {
  line: number;
  url: string;
  function: PointFunctionInfo | null;
  code?: string;
  // inputDependencies?: any;
  stackAndEvents?: RichStackFrame[];
  moreStackAndEvents?: string;
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

export type FrameStep = HasPoint &
  SourceLocation & {
    /** 1-dimensional index into the source code. */
    index: number;

    // TODO: add a FrameStep type to distinguish between:
    //   * DecisionStep
    //   * CallStep
    //   * ReturnStep
    //   * CompletionStep (return, break, continue)
    //   * etc.
  };
export type UniqueFrameStep = FrameStep & { hits: number };
