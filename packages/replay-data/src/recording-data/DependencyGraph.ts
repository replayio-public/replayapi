/* Copyright 2020-2024 Record Replay Inc. */
import { ExecutionPoint } from "@replayio/protocol";
import merge from "lodash/merge";
import orderBy from "lodash/orderBy";

import {
  AnalyzeDependenciesResult,
  AnalyzeDependenciesSpec,
  DependencyChainStep,
  DependencyGraphMode,
} from "../backend-wrapper/backend-types";
import { DGAnalyzeDependencies } from "../backend-wrapper/dg-wrapper";
import PointQueries from "./PointQueries";
import ReplaySession from "./ReplaySession";
import { CodeAtPoint, FrameWithPoint } from "./types";

const TargetDGEventCodes = ["ReactCreateElement", "PromiseSettled"] as const;
export type RichStackFrameKind = "sync" | (typeof TargetDGEventCodes)[number];

export type RawRichStackFrame = {
  kind: RichStackFrameKind;
  point: ExecutionPoint;
  functionName?: string;
};

export type RichStackFrame = CodeAtPoint & RawRichStackFrame;

/**
 * This wraps our DG analysis code (which for now primarily resides in the backend).
 */
export default class DependencyGraph {
  constructor(public readonly session: ReplaySession) {}

  async getDependencyChain(point: ExecutionPoint): Promise<AnalyzeDependenciesResult> {
    const spec = {
      recordingId: this.session.getRecordingId(),
      point,
      mode: DependencyGraphMode.ReactOwnerRenders,
      showPromises: true,
    } as AnalyzeDependenciesSpec;
    const options = {
      apiKey: this.session.ApiKey,
      spec,
    };
    return await DGAnalyzeDependencies(options);
  }

  private normalizeFrameForRichStack(frame: FrameWithPoint): RawRichStackFrame | null {
    if (!frame.point) {
      // Ignore frames without point for now.
      return null;
    }
    return {
      kind: "sync",
      point: frame.point?.point,
      functionName: frame.originalFunctionName || frame.functionName || "<anonymous>",
    };
  }

  private normalizeDGEventForRichStack(event: DependencyChainStep): RawRichStackFrame | null {
    if (!event.point) {
      // Ignore events without point for now.
      return null;
    }
    return {
      kind: event.code as (typeof TargetDGEventCodes)[number],
      point: event.point,
      // NOTE: Only some events provide the `functionName`.
      functionName: (event as any).functionName,
    };
  }

  /**
   * The "rich stack" is composed of the synchronous call stack interleaved with async events,
   * possibly including high-level framework (e.g. React) events.
   */
  async getNormalizedRichStackAtPoint(pointQueries: PointQueries): Promise<RichStackFrame[]> {
    const [frames, dgChain] = await Promise.all([
      pointQueries.getStackFramesWithPoint(),
      this.getDependencyChain(pointQueries.point),
    ]);

    const normalizedFrames = frames
      .map<RawRichStackFrame | null>(frame => this.normalizeFrameForRichStack(frame))
      .filter(Boolean);
    const normalizedDGEvents = dgChain.dependencies
      .map<RawRichStackFrame | null>(event => this.normalizeDGEventForRichStack(event))
      .filter(Boolean);

    // Interweave the two, sorted by point.
    const rawFrames = orderBy(
      merge([], normalizedFrames, normalizedDGEvents) as RawRichStackFrame[],
      [frame => BigInt(frame.point)],
      ["desc"]
    ).filter(shouldIncludeRawRichStackFrame);

    // Annotate the frames with more relevant data.
    const richFrames = await Promise.all(
      rawFrames.map(async f => {
        const p = await this.session.queryPoint(f.point);
        const code = await p.queryStatement();
        return {
          ...f,
          ...code,
        } as RichStackFrame;
      })
    );
    return richFrames.filter(shouldIncludeRichStackFrame);
  }
}

/** ###########################################################################
 * Frame culling heuristics.
 * IMPORTANT: Make sure to add all culling heuristics in the same place.
 * ##########################################################################*/

/**
 * Cull before getting extra data.
 */
function shouldIncludeRawRichStackFrame(frame: RawRichStackFrame) {
  if (!TargetDGEventCodes.includes(frame.kind as any)) {
    return false;
  }
  return true;
}
/**
 * Cull after getting extra data.
 */
function shouldIncludeRichStackFrame(frame: RichStackFrame) {
  if (frame.url.includes("node_modules")) {
    return false;
  }
  return true;
}
