/* Copyright 2020-2024 Record Replay Inc. */

import { RecordingId } from "@replayio/protocol";

/**
 * This data is shared between multiple tool calls over time and must be readily available
 * to the agent.
 */
export type AnalysisToolMetadata = {
  recordingId: RecordingId;
};
