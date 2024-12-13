/* Copyright 2020-2024 Record Replay Inc. */

import { AnalysisType } from "@replayio/data/src/analysis/dependencyGraphShared";
import { AnalysisInput } from "@replayio/data/src/analysis/dgSpecs";
import { runAnalysis } from "@replayio/data/src/analysis/runAnalysis";
import { ExecutionDataAnalysisResult } from "@replayio/data/src/analysis/specs/executionPoint";
import { getOrCreateReplaySession } from "@replayio/data/src/recordingData/ReplaySession";
import { program } from "commander";
import createDebug from "debug";

import { printCommandResult } from "../../commandsShared/print";
import { RecordingOption, requiresAPIKey } from "../options";

const debug = createDebug("replay:initial-analysis");

const command = program
  .command("initial-analysis")
  .description(
    "Looks for an initial comment. Returns the comment text, as well as dynamic control flow and data flow dependencies of the code at comment's `point`."
  )
  .argument(
    "<problemDescriptionFile>",
    "Path to a file that contains the description of the issue to fix."
  )
  .action(initialAnalysisAction);

requiresAPIKey(command);
// requiresRecording(command);

export async function initialAnalysisAction({
  recording: recordingId = "011f1663-6205-4484-b468-5ec471dc5a31",
}: RecordingOption): Promise<void> {
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
    debug(`run ExecutionPoint analysis...`);
    const analysisInput: AnalysisInput = {
      analysisType: AnalysisType.ExecutionPoint,
      spec: { recordingId },
    };
    const analysisResults = (await runAnalysis(
      session,
      analysisInput
    )) as ExecutionDataAnalysisResult;
    const { point, commentText: userComment, reactComponentName } = analysisResults;
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
