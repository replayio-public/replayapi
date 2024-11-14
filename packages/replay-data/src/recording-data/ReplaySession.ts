/* Copyright 2020-2024 Record Replay Inc. */

import "../bootstrap";

import { ExecutionPoint, RecordingId, SessionId } from "@replayio/protocol";
import { pauseIdCache } from "replay-next/src/suspense/PauseCache";
import { sourcesCache } from "replay-next/src/suspense/SourcesCache";
import { assert } from "protocol/utils";
import { ReplayClient } from "shared/client/ReplayClient";
import { STATUS_PENDING } from "suspense";

import ReplaySources from "./ReplaySources";
import PointQueries from "./PointQueries";

/**
 * The devtools require a `time` value for managing pauses, but it is not necessary.
 * PROBABLY, the only time it plays a role is when trying to visualize the point on the timeline.
 */
const DEFAULT_TIME = 0;

function getDispatchUrl() {
  return (
    process.env.DISPATCH_ADDRESS ||
    process.env.NEXT_PUBLIC_DISPATCH_URL ||
    "wss://dispatch.replay.io"
  );
}

export default class ReplaySession extends ReplayClient {
  public static readonly dispatchUrl = getDispatchUrl();

  private _sources: ReplaySources | null = null;
  private _busy = 0;

  constructor() {
    super(ReplaySession.dispatchUrl);
  }

  get ApiKey(): string {
    if (!process.env["REPLAY_API_KEY"]) {
      throw new Error(`REPLAY_API_KEY not provided`);
    }
    return process.env["REPLAY_API_KEY"]!;
  }

  async initialize(recordingId: RecordingId): Promise<SessionId> {
    return await super.initialize(recordingId, this.ApiKey);
  }

  /** ###########################################################################
   * Busy.
   * ##########################################################################*/

  get busy(): boolean {
    return !!this._busy;
  }

  private incBusy(): void {
    this._busy++;
  }

  private decBusy(): void {
    assert(this._busy > 0, "Busy counter MUST not be negative");
    this._busy--;
  }

  /** ###########################################################################
   * Sources.
   * ##########################################################################*/
  

  async getSources(): Promise<ReplaySources> {
    this.incBusy();
    try {
      await sourcesCache.readAsync(this);

      if (!this._sources) {
        const sources = sourcesCache.read(this);
        assert(sources, "Sources should be loaded");
        this._sources = new ReplaySources(this, sources);
      }
      return this._sources;
    } finally {
      this.decBusy();
    }
  }

  get sourcesLoading(): boolean {
    return sourcesCache.getStatus(this) === STATUS_PENDING;
  }


  /** ###########################################################################
   * Points.
   * ##########################################################################*/

  async queryPoint(point: ExecutionPoint): Promise<PointQueries> {
    const pauseId = await pauseIdCache.readAsync(this, point, DEFAULT_TIME);
    return new PointQueries(this, point, pauseId);
  }
}

let replaySession: ReplaySession | null = null;

export function getReplaySession(): ReplaySession {
  if (!replaySession) {
    throw new Error(`No Replay session exists. Call ${createReplaySession.name} first.`);
  }
  return replaySession;
}

export async function createReplaySession(recordingId: RecordingId): Promise<ReplaySession> {
  if (replaySession) {
    // This is a restriction on the devtools side.
    throw new Error(
      `A Replay session already existed for a different recordingId. The Replay API client currently only supports one session per process.`
    );
  }
  replaySession = new ReplaySession();
  if (!recordingId) {
    throw new Error(`recordingId not provided and session did not exist.`);
  }
  await replaySession.initialize(recordingId);
  return replaySession;
}
