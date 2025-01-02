/* Copyright 2020-2024 Record Replay Inc. */

import { getOrCreateReplaySession } from "@replayio/data/src/recordingData/ReplaySession";
import { program } from "commander";
import createDebug from "debug";

import { printCommandError, printCommandResult } from "../../commandsShared/commandOutput";
import { PointOption, RecordingOption, requiresPoint, requiresRecording } from "../options";

const debug = createDebug("replay:inspect-data");

const command = program
  .command("inspect-data")
  .description("Explains dynamic control flow and data flow dependencies of the code at `point`.")
  .option("-e, --expression <expression>", "Expression of interest at point.")
  .action(inspectDataAction);

requiresRecording(command);
requiresPoint(command);

export async function inspectDataAction(
  options: RecordingOption & PointOption & { expression: string }
): Promise<void> {
  // Start...
  debug(`starting inspectDataAction...`, options);
  const { recordingId, point, expression } = options;

  if (!recordingId) {
    printCommandError("NoRecordingId");
    return;
  }
  if (!point) {
    printCommandError("NoPoint");
    return;
  }

  // 1. Initialize session.
  debug(`connecting to Replay server...`);
  const session = await getOrCreateReplaySession(recordingId);

  try {
    const p = await session.queryPoint(point);
    const inspectResult = await p.inspectData(expression);

    printCommandResult({ thisPoint: point, ...inspectResult });
  } finally {
    session?.disconnect();
  }
}
