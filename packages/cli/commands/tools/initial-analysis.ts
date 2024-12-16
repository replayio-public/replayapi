/* Copyright 2020-2024 Record Replay Inc. */

import { runInitialAnalysis } from "@replayio/data/src/analysis/runAnalysis";
import { getOrCreateReplaySession } from "@replayio/data/src/recordingData/ReplaySession";
import { program } from "commander";
import createDebug from "debug";

import { printCommandResult } from "../../commandsShared/print";
import { RecordingOption, requiresAPIKey, requiresRecording } from "../options";

const debug = createDebug("replay:initial-analysis");

const command = program
  .command("initial-analysis")
  .description(
    "Looks for an initial comment. Returns the comment text, as well as dynamic control flow and data flow dependencies of the code at comment's `point`."
  )
  .action(initialAnalysisAction);

requiresAPIKey(command);
requiresRecording(command);

export async function initialAnalysisAction({ recordingId }: RecordingOption): Promise<void> {
  // Start...
  debug(`starting inspectPointAction...`);

  if (!recordingId) {
    printCommandResult({ status: "NoRecordingId" });
    return;
  }

  // 1. Initialize session.
  debug(`connecting to Replay server...`);
  const session = await getOrCreateReplaySession(recordingId);

  try {
    // 2. Find point and run analysis on that point.
    const { point, userComment, reactComponentName } = await runInitialAnalysis(session);
    if (!point || !userComment) {
      printCommandResult({ status: "NoVisualComment" });
      return;
    }

    const p = await session.queryPoint(point);
    const pointInfo = await p.inspectPoint();

    const result = {
      status: "Success",
      result: {
        thisPoint: point,
        userComment,
        reactComponentName,
        ...pointInfo,
      },
    };

    printCommandResult(result);
  } finally {
    session?.disconnect();
  }
}
