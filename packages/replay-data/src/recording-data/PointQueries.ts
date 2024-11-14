/* Copyright 2020-2024 Record Replay Inc. */

import SourceParser from "@replay/source-parser/src/SourceParser";
import { ExecutionPoint, Frame, PauseId } from "@replayio/protocol";
import { framesCache } from "replay-next/src/suspense/FrameCache";
import { pointStackCache } from "replay-next/src/suspense/PointStackCache";

import { BigIntToPoint, ExecutionPointInfo } from "../util/points";
import DependencyGraph, { RichStackFrame } from "./DependencyGraph";
import ReplaySession from "./ReplaySession";
import {
  CodeAtPoint,
  FrameWithPoint,
  PointFunctionInfo,
  IndexedPointStackFrame,
  LocationWithUrl,
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
    return frames.map(
      (frame: Frame, i) => ({ ...frame, point: points[i]!.point }) as FrameWithPoint
    );
  }

  async thisFrame(): Promise<Frame> {
    const [thisFrame] = await this.getStackFrames();
    return thisFrame;
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

  async queryFunctionInfo(): Promise<PointFunctionInfo> {
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
  //   // TODO
  // }

  // /**
  //  * TODO: Replace this w/ a combination of (i) summarization + (ii) in-frame point mappings.
  //  * Dynamic control dependencies from `point` to `thisFrame.startPoint` that are not already in `scopes`.
  //  */
  // async queryControlDependencies() {
  //   // TODO
  // }

  // /**
  //  * Static and dynamic data of all scopes containing `point`, including nesting branches, the current function call, classes etc.
  //  */
  // async queryScopes() {
  //   // NOTE: This is not a top priority, but I can see it important in certain debugging scenarios.
  //   // TODO: See if and where we need it.
  // }
}
