/* Copyright 2020-2024 Record Replay Inc. */
import { ExecutionPoint } from "@replayio/protocol";
import { CodeAtLocation } from "@replayio/source-parser/src/types";
import orderBy from "lodash/orderBy";

import {
  AnalysisType,
  DependencyChainStep,
  DependencyGraphMode,
} from "../analysis/dependencyGraphShared";
import { AnalysisInput } from "../analysis/dgSpecs";
import { runAnalysis } from "../analysis/runAnalysis";
import { AnalyzeDependenciesResult } from "../analysis/specs/analyzeDependencies";
import { wrapAsyncWithHardcodedData } from "./hardcodedData";
import PointQueries from "./PointQueries";
import ReplaySession from "./ReplaySession";
import { FrameWithPoint } from "./types";

export const MaxEventChainLength = 10;

const FilteredDGEventCodes = ["ReactCreateElement", "PromiseSettled"] as const;
export type RichStackFrameKind = "StackFrame" | (typeof FilteredDGEventCodes)[number];

export type RawRichStackFrame = {
  kind: RichStackFrameKind;
  point: ExecutionPoint;
  functionName?: string;
};

export type RichStackFrame = CodeAtLocation & RawRichStackFrame;

/**
 * This wraps our DG analysis code (which for now primarily resides in the backend).
 */
export default class DependencyChain {
  constructor(public readonly session: ReplaySession) {}

  async getDependencyChain(
    point: ExecutionPoint,
    forceLookup = false
  ): Promise<AnalyzeDependenciesResult> {
    const specNoRecordingId = {
      point,
      mode: DependencyGraphMode.ReactOwnerRenders,
    };
    return await wrapAsyncWithHardcodedData({
      recordingId: this.session.getRecordingId()!,
      name: "dgChain",
      forceLookup,
      input: specNoRecordingId,
      cb: async (specNoRecordingId): Promise<AnalyzeDependenciesResult | undefined> => {
        const analysisInput: AnalysisInput = {
          analysisType: AnalysisType.Dependency,
          spec: { ...specNoRecordingId, recordingId: this.session.getRecordingId()! },
        };
        return await runAnalysis<AnalyzeDependenciesResult>(this.session, analysisInput);
      },
    });
  }

  private normalizeFrameForRichStack(frame: FrameWithPoint): RawRichStackFrame | null {
    if (!frame.point) {
      // Ignore frames without point for now.
      return null;
    }
    return {
      kind: "StackFrame",
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
      kind: event.code as (typeof FilteredDGEventCodes)[number],
      point: event.point,
      // NOTE: Only some events provide the `functionName`.
      functionName: "functionName" in event ? event.functionName : undefined,
    };
  }

  /**
   * The "rich stack" is not really a stack, but rather a mix of the synchronous call stack, interleaved with async events,
   * including high-level framework (e.g. React) events, order by time (latest first).
   */
  async getNormalizedStackAndEventsAtPoint(
    pointQueries: PointQueries,
    forceLookup = false
  ): Promise<[boolean, RichStackFrame[]]> {
    const [frames, dgChain] = await Promise.all([
      pointQueries.getStackFramesWithPoint(),
      this.getDependencyChain(pointQueries.point, forceLookup),
    ]);

    const normalizedFrames = frames
      .map<RawRichStackFrame | null>(frame => this.normalizeFrameForRichStack(frame))
      .filter(v => !!v)
      // Remove the current frame from stack. We already have that.
      // TODO: Dedup.
      //    * Multiple points can map to the same hit on the same breakable location.
      //    * Especially bookmarks.
      //    * TODO: Dedup those as well.
      .filter(v => v.point !== pointQueries.point);

    const normalizedDGEvents = (dgChain.dependencies || [])
      .map<RawRichStackFrame | null>(event => this.normalizeDGEventForRichStack(event))
      .filter(v => !!v)
      // We are only interested in a subset of event types.
      .filter(DGEventTypeFilter);

    // Interweave the two, sorted by point.
    const rawFrames = orderBy(
      normalizedFrames.concat(normalizedDGEvents) as RawRichStackFrame[],
      [
        frame => {
          return BigInt(frame.point);
        },
      ],
      ["desc"]
    );

    // Annotate the frames with more relevant data.
    const richFrames = await Promise.all(
      rawFrames.map(async f => {
        const p = await this.session.queryPoint(f.point);
        if (await p.isThirdPartyCode()) {
          // Ignore node_modules + friends for now.
          // TODO: Instead of ignoring all, collapse multiple third-party code frames into one.
          return null;
        }
        const [code] = await Promise.all([
          p.queryCodeAndLocation(),
          // NOTE: queryCodeAndLocation already returns `functionName`.
          // p.queryFunctionInfo(),
        ]);
        return {
          ...f,
          ...code,
        } as RichStackFrame;
      })
    );

    const result = richFrames.filter(f => !!f);
    if (result.length > MaxEventChainLength) {
      return [true, result.slice(0, MaxEventChainLength)];
    }
    return [false, result];
  }
}

/** ###########################################################################
 * Frame culling heuristics.
 * IMPORTANT: Make sure to add all culling heuristics in the same place.
 * ##########################################################################*/

/**
 * Cull before getting extra data.
 */
function DGEventTypeFilter(frame: RawRichStackFrame) {
  const includedEventCodes: readonly RichStackFrameKind[] = FilteredDGEventCodes;
  return includedEventCodes.includes(frame.kind);
}
