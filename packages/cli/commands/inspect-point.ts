/* Copyright 2020-2024 Record Replay Inc. */

import createDebug from 'debug';

import { AnalysisType } from "@replayio/data/src/analysis/dependencyGraphShared";
import { AnalysisInput } from "@replayio/data/src/analysis/dgSpecs";
import { runAnalysis } from "@replayio/data/src/analysis/runAnalysis";
import { ExecutionDataAnalysisResult } from "@replayio/data/src/analysis/specs/executionPoint";
import { getOrCreateReplaySession } from "@replayio/data/src/recordingData/ReplaySession";
import { assert } from "@replayio/data/src/util/assert";
import { program } from "commander";

import { printCommandResult } from "../commandsShared/print";
import {
  PointOption,
  RecordingOption,
  requiresAPIKey,
  requiresPoint,
  requiresRecording,
} from "./options";

const debug = createDebug("replay:inspect-point");

const command = program
  .command("inspect-point")
  .description("Explains dynamic control flow and data flow dependencies of the code at `point`.")
  .argument(
    "<problemDescriptionFile>",
    "Path to a file that contains the description of the issue to fix."
  )
  .action(inspectPointAction);

requiresAPIKey(command);
requiresRecording(command);
requiresPoint(command);

export async function inspectPointAction({
  recording: recordingId,
  point,
}: RecordingOption & PointOption): Promise<void> {
  // Start...
  debug(`starting w/ inspectPointAction...`);

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
    // 2. Run data flow analysis at point.
    const analysisInput: AnalysisInput = {
      analysisType: AnalysisType.ExecutionPoint,
      spec: { recordingId },
    };
    debug(`analyzing point at recording...`);
    const analysisResults = (await runAnalysis(
      session,
      analysisInput
    )) as ExecutionDataAnalysisResult;

    const {
      // TODO: `commentText` is misleading. The analysis does not return the comment text at given point.
      // commentText,
      reactComponentName,
    } = analysisResults;

    printCommandResult({
      status: "Success",
      point,
      reactComponentName,
    });
  } finally {
    session?.disconnect();
  }
}
