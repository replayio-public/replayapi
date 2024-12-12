/* Copyright 2020-2024 Record Replay Inc. */

import createDebug from 'debug';

import { AnalysisType } from "@replayio/data/src/analysis/dependencyGraphShared";
import { AnalysisInput } from "@replayio/data/src/analysis/dgSpecs";
import { runAnalysis } from "@replayio/data/src/analysis/runAnalysis";
import { ExecutionDataAnalysisResult } from "@replayio/data/src/analysis/specs/executionPoint";
import { getOrCreateReplaySession } from "@replayio/data/src/recordingData/ReplaySession";
import { program } from "commander";

import { printCommandResult } from "../commandsShared/print";
import { RecordingOption, requiresAPIKey } from "./options";

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
  debug(`starting w/ inspectPointAction...`);

  if (!recordingId) {
    printCommandResult({ status: "NoRecordingId" });
    return;
  }

  // 1. Initialize session.
  debug(`connecting to Replay server...`);
  const session = await getOrCreateReplaySession(recordingId);

  try {
    // 2. Find point and run analysis on that point.
    const analysisInput: AnalysisInput = {
      analysisType: AnalysisType.ExecutionPoint,
      spec: { recordingId },
    };
    debug(`analyzing point at recording...`);
    const analysisResults = (await runAnalysis(
      session,
      analysisInput
    )) as ExecutionDataAnalysisResult;

    const { point, commentText: userComment, reactComponentName } = analysisResults;
    if (!point || !userComment) {
      printCommandResult({ status: "NoVisualComment" });
      return;
    }

    const pointQueries = await session.queryPoint(point);
    const stackAndEvents = await pointQueries.queryStackAndEvents();

    printCommandResult({
      status: "Success",
      thisPoint: point,
      userComment,
      // location,
      // function,
      reactComponentName,
      // inputDependencies,
      // directControlDependencies,
      stackAndEvents,
    });
  } finally {
    session?.disconnect();
  }
}
