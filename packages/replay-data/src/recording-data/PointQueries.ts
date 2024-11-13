/* Copyright 2020-2024 Record Replay Inc. */

import { ExecutionPoint, Frame, PauseId } from "@replayio/protocol";
import { framesCache } from "replay-next/src/suspense/FrameCache";

import { BigIntToPoint, ExecutionPointInfo } from "../util/points";
import ReplaySession from "./ReplaySession";

const POINT_ANNOTATION = "/*BREAK*/";

export class PointStatement {
  constructor(
    public line: number,
    public url: string,
    public code: string
  ) {}
}

export default class PointQueries {
  session: ReplaySession;
  point: ExecutionPoint;
  pointData: ExecutionPointInfo;
  pauseId: PauseId;

  constructor(replaySession: ReplaySession, point: ExecutionPoint, pauseId: PauseId) {
    this.session = replaySession;
    this.pauseId = pauseId;
    this.point = point;
    this.pointData = BigIntToPoint(BigInt(point));
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

  async thisFrame(): Promise<Frame> {
    // NOTE: We could use `getPointStack` instead.
    const frames = await this.getStackFrames();
    return frames[0];
  }

  // async getPointStack() {
  //   // TODO: getPointStack
  // }

  /** ###########################################################################
   * High-level Queries.
   * ##########################################################################*/

  /**
   * Get data for the statement at `point`.
   */
  async queryStatement(): Promise<PointStatement> {
    const [thisFrame, sources] = await Promise.all([this.thisFrame(), this.session.getSources()]);

    const thisLocation = sources.getBestLocation(thisFrame.location);
    const url = sources.getUrl(thisLocation.sourceId) || "";

    const parser = await sources.parseContents(thisLocation.sourceId);
    const statementCode = parser.getAnnotatedNodeTextAt(thisLocation, POINT_ANNOTATION) || "";

    if (!url) {
      console.warn(`[PointQueries] No source url found at point ${this.point}`);
    }
    if (!statementCode) {
      console.warn(`[PointQueries] No statement code found at point ${this.point}`);
    }

    // TODO: Also provide hit index + hit count when necessary.
    
    return new PointStatement(thisLocation.line, url, statementCode);
  }

  // /**
  //  * Static and dynamic data of all scopes containing `point`, including nesting branches, the current function call, classes etc.
  //  */
  // async queryScopes() {
  //   // TODO
  // }

  // async queryInputDependencies() {
  //   // TODO
  // }

  // /**
  //  * Dynamic control dependencies from `point` to `thisFrame.startPoint` that are not already in `scopes`.
  //  */
  // async queryIndirectControlDependencies() {
  //   // TODO
  // }

  // /**
  //  * The "rich stack" is composed of the synchronous call stack and the async stack, possibly including high-level asynchronous and framework events.
  //  */
  // async queryRichStack() {
  //   // TODO
  // }
}
