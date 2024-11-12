/* Copyright 2020-2024 Record Replay Inc. */

import "./bootstrap";

import { ExecutionPoint, RecordingId, SessionId } from "@replayio/protocol";
import { pauseIdCache } from "replay-next/src/suspense/PauseCache";
import { ReplayClient } from "shared/client/ReplayClient";

import PointQueries from "./recording-data/PointQueries.js";

/**
 * Debugging recordingId used only during early development.
 */
const DEFAULT_RECORDING_ID = "011f1663-6205-4484-b468-5ec471dc5a31";

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

export default class ReplayApi extends ReplayClient {
  constructor() {
    super(getDispatchUrl());
  }

  async initialize(recordingId: RecordingId = DEFAULT_RECORDING_ID): Promise<SessionId> {
    if (!process.env["REPLAY_API_KEY"]) {
      throw new Error(`REPLAY_API_KEY not provided`);
    }
    return await super.initialize(recordingId, process.env["REPLAY_API_KEY"]!);
  }

  async queryPoint(point: ExecutionPoint): Promise<PointQueries> {
    const pauseId = await pauseIdCache.readAsync(this, point, DEFAULT_TIME);
    return new PointQueries(this, point, pauseId);
  }
}

let replaySession: ReplayApi | null = null;

export function getReplaySession(): ReplayApi {
  if (!replaySession) {
    throw new Error(`No Replay session exists. Call ${createReplaySession.name} first.`);
  }
  return replaySession;
}

export async function createReplaySession(recordingId: RecordingId): Promise<ReplayApi> {
  if (replaySession) {
    // This is a restriction on the devtools side.
    throw new Error(
      `A Replay session already existed for a different recordingId. The Replay API client currently only supports one session per process.`
    );
  }
  replaySession = new ReplayApi();
  if (!recordingId) {
    throw new Error(`recordingId not provided and session did not exist.`);
  }
  await replaySession.initialize(recordingId);
  return replaySession;
}
