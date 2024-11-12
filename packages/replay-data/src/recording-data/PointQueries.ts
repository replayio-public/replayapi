/* Copyright 2020-2024 Record Replay Inc. */

import { ExecutionPoint, PauseId } from "@replayio/protocol";

import ReplayApi from "../ReplaySession";

export class PointStatement {
  constructor(
    public line: number,
    public url: string,
    public code: string
  ) {}
}

export default class PointQueries {
  session: ReplayApi;
  point: ExecutionPoint;
  pauseId: PauseId;

  constructor(replaySession: ReplayApi, point: ExecutionPoint, pauseId: PauseId) {
    this.session = replaySession;
    this.point = point;
    this.pauseId = pauseId;
  }

  // async queryStatement() {

  // }

  // /**
  //  * Static and dynamic data of all scopes containing the point, including nesting branches, the current function call, classes etc.
  //  */
  // async queryScopes() {
  //   // TODO
  // }

  // async queryInputDependencies() {

  // }

  // /**
  //  * Dynamic control dependencies from `this.point` to `thisFrame.startPoint` that are not already in `scopes`.
  //  */
  // async queryIndirectControlDependencies() {

  // }

  // /**
  //  * The "rich stack" is composed of the synchronous call stack and the async stack, possibly including high-level asynchronous and framework events.
  //  */
  // async queryRichStack() {

  // }
}
