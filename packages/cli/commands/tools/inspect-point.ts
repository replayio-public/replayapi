/* Copyright 2020-2024 Record Replay Inc. */

import { getOrCreateReplaySession } from "@replayio/data/src/recordingData/ReplaySession";
import { program } from "commander";
import createDebug from "debug";

import { printCommandResult } from "../../commandsShared/commandOutput";
import { PointOption, RecordingOption, requiresPoint, requiresRecording } from "../options";

const debug = createDebug("replay:inspect-point");

const command = program
  .command("inspect-point")
  .description("Explains dynamic control flow and data flow dependencies of the code at `point`.")
  .action(inspectPointAction);

requiresRecording(command);
requiresPoint(command);

export async function inspectPointAction({
  recordingId,
  point,
}: RecordingOption & PointOption): Promise<void> {
  // Start...
  debug(`starting inspectPointAction...`);

  if (!recordingId) {
    printCommandResult({ status: "NoRecordingId" });
    return;
  }
  if (!point) {
    printCommandResult({ status: "NoPoint" });
    return;
  }

  // 1. Initialize session.
  debug(`connecting to Replay server...`);
  const session = await getOrCreateReplaySession(recordingId);

  try {
    const p = await session.queryPoint(point);
    const inspectResult = await p.inspectPoint();

    printCommandResult({
      status: "Success",
      result: {
        thisPoint: point,
        ...inspectResult,
      },
    });
  } finally {
    session?.disconnect();
  }
}
