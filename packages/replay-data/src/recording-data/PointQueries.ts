/* Copyright 2020-2024 Record Replay Inc. */

import StaticScope from "@replay/source-parser/src/bindings/StaticScope";
import SourceParser from "@replay/source-parser/src/SourceParser";
import { ExecutionPoint, Frame, PauseId } from "@replayio/protocol";
import { framesCache } from "replay-next/src/suspense/FrameCache";
import { pointStackCache } from "replay-next/src/suspense/PointStackCache";
import { FrameScopes, frameScopesCache } from "replay-next/src/suspense/ScopeCache";

import { BigIntToPoint, ExecutionPointInfo } from "../util/points";
import DynamicScope from "./bindings/DynamicScope";
import DependencyGraph, { RichStackFrame } from "./DependencyGraph";
import ReplaySession from "./ReplaySession";
import {
  CodeAtPoint,
  FrameWithPoint,
  IndexedPointStackFrame,
  LocationWithUrl,
  PointFunctionInfo,
} from "./types";

const POINT_ANNOTATION = "/*BREAK*/";

export default class PointQueries {
  readonly session: ReplaySession;
  readonly point: ExecutionPoint;
  readonly pointData: ExecutionPointInfo;
  readonly pauseId: PauseId;
  readonly dg: DependencyGraph;

  private parser: Promise<SourceParser> | null = null;

  constructor(session: ReplaySession, point: ExecutionPoint, pauseId: PauseId) {
    this.session = session;
    this.pauseId = pauseId;
    this.point = point;
    this.pointData = BigIntToPoint(BigInt(point));
    this.dg = new DependencyGraph(session);
  }

  /** ###########################################################################
   * Basic Queries.
   * ##########################################################################*/

  /**
   * @returns The stack as reported by the runtime. This is generally mostly the synchronous stack.
   */
  async getStackFrames(): Promise<Frame[]> {
    const frames = await framesCache.readAsync(this.session, this.pauseId);
    if (!frames?.length) {
      throw new Error(`[PointQueries] Stack is empty at point ${this.point}`);
    }
    return frames;
  }

  async getPointStack(frameIndex: number): Promise<IndexedPointStackFrame[]> {
    return await pointStackCache.readAsync(0, frameIndex, this.session, this.point);
  }

  async getStackFramesWithPoint(): Promise<FrameWithPoint[]> {
    const frames = await this.getStackFrames();
    const points = await this.getPointStack(frames.length - 1);
    return frames.map((frame: Frame, i) => ({ ...frame, point: points[i]!.point }));
  }

  async getAsyncStackFramesWithPoint(): Promise<FrameWithPoint[]> {
    // TODO: also get async frames where available.
    // NOTE: We have some rudimentary async stack support in devtools here:
    //        https://github.com/replayio/devtools/blob/main/src/devtools/client/debugger/src/components/SecondaryPanes/Frames/NewFrames.tsx#L62
    return [];
  }

  async thisFrame(): Promise<Frame> {
    const [thisFrame] = await this.getStackFrames();
    return thisFrame;
  }

  async thisFrameScopes(): Promise<FrameScopes> {
    const thisFrame = await this.thisFrame();
    return frameScopesCache.readAsync(this.session, this.pauseId, thisFrame.frameId);
  }

  /** ###########################################################################
   * Source Queries.
   * ##########################################################################*/

  async getSourceLocation(): Promise<LocationWithUrl> {
    const [thisFrame, allSources] = await Promise.all([
      this.thisFrame(),
      this.session.getSources(),
    ]);

    const thisLocation = allSources.getBestLocation(thisFrame.location);
    const url = allSources.getUrl(thisLocation.sourceId) || "";
    return {
      ...thisLocation,
      url,
    };
  }

  async parseSource(): Promise<SourceParser> {
    if (!this.parser) {
      const [thisLocation, allSources] = await Promise.all([
        this.getSourceLocation(),
        this.session.getSources(),
      ]);

      this.parser = allSources.parseContents(thisLocation.sourceId);
    }
    return await this.parser;
  }

  /** ###########################################################################
   * High-level Queries.
   * ##########################################################################*/

  /**
   * Get data for the statement at `point`.
   */
  async queryStatement(): Promise<CodeAtPoint> {
    const [thisLocation, parser] = await Promise.all([
      this.getSourceLocation(),
      this.parseSource(),
    ]);

    const statementCode = parser.getAnnotatedNodeTextAt(thisLocation, POINT_ANNOTATION) || "";

    if (!thisLocation.url) {
      console.warn(`[PointQueries] No source url found at point ${this.point}`);
    }
    if (!statementCode) {
      console.warn(`[PointQueries] No statement code found at point ${this.point}`);
    }

    // TODO: Also provide hit index + hit count when necessary.

    return {
      line: thisLocation.line,
      url: thisLocation.url,
      code: statementCode,
    };
  }

  async queryFunctionInfo(): Promise<PointFunctionInfo | null> {
    const [thisLocation, parser] = await Promise.all([
      this.getSourceLocation(),
      this.parseSource(),
    ]);
    return parser.getFunctionInfoAt(thisLocation);
  }

  async queryRichStack(): Promise<RichStackFrame[]> {
    return await this.dg.getNormalizedRichStackAtPoint(this);
  }

  // async queryInputDependencies() {
  //   const [thisLocation, parser] = await Promise.all([
  //     this.getSourceLocation(),
  //     this.parseSource(),
  //   ]);

  //   const deps = parser.getInterestingInputDependencies(thisLocation);

  //   // TODO: Also find bindings for each dep.
  //   // TODO: Add relevant context for each dep.
  // }

  async queryDynamicScopes(): Promise<DynamicScope[]> {
    const [thisLocation, frameScopes, parser] = await Promise.all([
      this.getSourceLocation(),
      this.thisFrameScopes(),
      this.parseSource(),
    ]);

    const staticScope = parser.bindings.getScopeAt(thisLocation);
    const recordedScopes = frameScopes.originalScopes || frameScopes.generatedScopes;

    // Store static scopes by parent in array.
    const staticScopes = [];
    let currentStaticScope: StaticScope | null = staticScope;
    while (currentStaticScope) {
      staticScopes.push(currentStaticScope);
      currentStaticScope = currentStaticScope.parent;
    }

    // Iterate scopes outer to inner.
    const scopes: DynamicScope[] = [];
    let lastScope: DynamicScope | null = null;
    for (let i = Math.max(staticScopes.length, recordedScopes.length) - 1; i >= 0; i--) {
      const currentStaticScope = staticScopes[i];
      const currentRecordedScope = recordedScopes[i];
      const newScope = (lastScope = new DynamicScope(
        this,
        lastScope,
        currentStaticScope,
        currentRecordedScope?.bindings || []
      ));
      scopes.push(newScope);
    }

    return scopes;
  }

  // /**
  //  * TODO: Replace this w/ a combination of (i) summarization + (ii) in-frame point mappings.
  //  * Dynamic control dependencies from `point` to `thisFrame.startPoint` that are not already in `scopes`.
  //  */
  // async queryControlDependencies() {
  //   // TODO
  // }

  // /**
  //  *
  //  */
  // async valuePreview(expression: string) {
  //   // TODO
  // }
}
