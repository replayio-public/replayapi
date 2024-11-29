/* Copyright 2020-2024 Record Replay Inc. */

import "../bootstrap";

import { ExecutionPoint, RecordingId, SessionId } from "@replayio/protocol";
import { sendMessage } from "protocol/socket";
import { assert } from "protocol/utils";
import { pauseIdCache } from "replay-next/src/suspense/PauseCache";
import { sourcesCache } from "replay-next/src/suspense/SourcesCache";
import { ReplayClient } from "shared/client/ReplayClient";
import { STATUS_PENDING } from "suspense";

import PointQueries from "./PointQueries";
import ReplaySources from "./ReplaySources";

/**
 * The devtools require a `time` value for managing pauses, but it is not necessary.
 * PROBABLY, the only time it plays a role is when trying to visualize the point on the timeline.
 */
const DEFAULT_TIME = 0;

export function getDispatchUrl(): string {
  return (
    process.env.DISPATCH_ADDRESS ||
    process.env.NEXT_PUBLIC_DISPATCH_URL ||
    "wss://dispatch.replay.io"
  );
}

export function getApiKey(): string {
  if (!process.env["REPLAY_API_KEY"]) {
    throw new Error(`REPLAY_API_KEY not provided`);
  }
  return process.env["REPLAY_API_KEY"]!;
}

export default class ReplaySession extends ReplayClient {
  public static readonly dispatchUrl = getDispatchUrl();

  private _sources: ReplaySources | null = null;
  private _busy = 0;

  constructor() {
    super(ReplaySession.dispatchUrl);
  }

  get ApiKey(): string {
    return getApiKey();
  }

  async initialize(recordingId: RecordingId): Promise<SessionId> {
    return await super.initialize(recordingId, getApiKey());
  }

  disconnect(): void {
    // NOTE1: We only have one unexposed `socket` object in `protocol/socket.ts`.
    // NOTE2: That file also registers a global `disconnect` function, so we can at least close it.
    (global as any).disconnect?.();
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
   * experimentalCommand
   * ##########################################################################*/

  async experimentalCommand(name: string, params: Record<string, any>): Promise<any> {
    const sessionId = await this.waitForSession();
    const result = await sendMessage("Session.experimentalCommand", { name, params }, sessionId);
    return result.rval;
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
