/* Copyright 2020-2024 Record Replay Inc. */

import "../bootstrap";

import { ExecutionPoint, RecordingId, SessionId } from "@replayio/protocol";
import createDebug from "debug";
import { sendMessage } from "protocol/socket";
import { assert } from "protocol/utils";
import { pauseIdCache } from "replay-next/src/suspense/PauseCache";
import { sourcesCache } from "replay-next/src/suspense/SourcesCache";
import { ReplayClient } from "shared/client/ReplayClient";
import { STATUS_PENDING } from "suspense";

import { AnalysisType } from "../analysis/dependencyGraphShared";
import { AnalysisInput } from "../analysis/dgSpecs";
import { wrapAsyncWithHardcodedData } from "../analysis/hardcodedResults";
import { runAnalysis } from "../analysis/runAnalysis";
import { ExecutionDataAnalysisResult } from "../analysis/specs/executionPoint";
import PointQueries from "./PointQueries";
import ReplaySources from "./ReplaySources";

const debug = createDebug("replay:ReplaySession");

export type FindInitialPointResult = {
  point?: ExecutionPoint;
  userComment?: string;
  reactComponentName?: string;
};

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
    const sessionId = await super.initialize(recordingId, getApiKey());
    debug(`Initialized session "${sessionId}".`);
    return sessionId;
  }

  disconnect(): void {
    // NOTE1: We only have one unexposed `socket` object in `protocol/socket.ts`.
    // NOTE2: That file also registers a global `disconnect` function, so we can at least close it.
    try {
      (global as any).disconnect?.();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_err: any) {
      // Mute error.
      // Note: This could happen, if the socket is already closed or not yet initialized.
    }
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

  async findInitialPoint(): Promise<FindInitialPointResult> {
    const recordingId = this.getRecordingId()!;
    const analysisInput: AnalysisInput = {
      analysisType: AnalysisType.ExecutionPoint,
      spec: { recordingId },
    };
    return await wrapAsyncWithHardcodedData(recordingId, "findInitialPoint", async () => {
      const analysisResults = await runAnalysis<ExecutionDataAnalysisResult>(this, analysisInput);
      const { point, commentText: userComment, reactComponentName } = analysisResults;
      return { point, userComment, reactComponentName };
    });
  }

  async queryPoint(point: ExecutionPoint): Promise<PointQueries> {
    debug(`queryPoint ${point}...`);
    const pauseId = await pauseIdCache.readAsync(this, point, DEFAULT_TIME);
    return new PointQueries(this, point, pauseId);
  }
}

let replaySessionPromise: Promise<ReplaySession> | null = null;

export async function getOrCreateReplaySession(recordingId: string): Promise<ReplaySession> {
  if (!replaySessionPromise) {
    const session = new ReplaySession();
    await (replaySessionPromise = session.initialize(recordingId).then(() => session));
    return session;
  } else {
    const session = await replaySessionPromise;

    // NOTE: We cannot currently have multiple sessions for different recordings in the same process, since
    // the client, as well as all cached data are globals.
    assert(
      session.getRecordingId() === recordingId,
      `Cannot create multiple sessions for different recordings. Old: ${session.getRecordingId()} != new: ${recordingId}`
    );
    return session;
  }
}
