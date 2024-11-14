/* Copyright 2020-2024 Record Replay Inc. */
import { ExecutionPoint } from "@replayio/protocol";
import merge from "lodash/merge";
import orderBy from "lodash/orderBy";

import PointQueries from "./PointQueries";
import ReplaySession from "./ReplaySession";
import { CodeAtPoint, FrameWithPoint } from "./types";
import { AnalyzeDependenciesResult, AnalyzeDependenciesSpec, DependencyChainStep, DependencyGraphMode } from "../backend-wrapper/backend-types";
import { DGAnalyzeDependencies } from "../backend-wrapper/dg-wrapper";

const TargetDGEventCodes = ["ReactCreateElement", "PromiseSettled"] as const;
export type RichStackFrameKind = "sync" | typeof TargetDGEventCodes[number];

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
      spec
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
      point: frame.point,
      functionName: frame.originalFunctionName
    };
  }

  private normalizeDGEventForRichStack(event: DependencyChainStep): RawRichStackFrame | null {
    if (event.code === "ReactRender") {
      // Ignore render calls for now, since they point to the render function start.
      // NOTE: `ReactCreateElement` generally points to the correct caller.
      return null;
    }
    if (!event.point) {
      // Ignore events without point for now.
      return null;
    }
    const kind = event.code as typeof TargetDGEventCodes[number];
    if (!TargetDGEventCodes.includes(kind)) {
      return null;
    }
    return {
      kind,
      point: event.point,
      // NOTE: Only some events provide the `functionName`.
      functionName: (event as any).functionName
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
    const normalizedAsyncEvents = dgChain.dependencies
      .map<RawRichStackFrame | null>(event => this.normalizeDGEventForRichStack(event))
      .filter(Boolean);

    // Interweave the two, sorted by point.
    const rawFrames =  orderBy(
      merge([], normalizedFrames, normalizedAsyncEvents) as RawRichStackFrame[],
      [frame => BigInt(frame.point)],
      ["desc"]
    );

    return (await Promise.all(rawFrames.map(async f => {
      const p = await this.session.queryPoint(f.point);
      const code = await p.queryStatement();
      return {
        ...f,
        ...code
      } as RichStackFrame;
    }))).filter(Boolean);
  }
}
