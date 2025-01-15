/* Copyright 2020-2024 Record Replay Inc. */

import { getOrCreateReplaySession } from "@replayio/data/src/recordingData/ReplaySession";
import {
  scanReplayUrl,
} from "@replayio/data/src/recordingData/replayStringUtil";
import { InspectPointResult } from "@replayio/data/src/recordingData/types";
import { program } from "commander";
import createDebug from "debug";

import { printCommandError, printCommandResult } from "../../commandsShared/commandOutput";
import { AnalysisToolMetadata } from "./tools-shared";

const debug = createDebug("replay:initial-analysis");

export type InitialAnalysisCommandOptions = {
  prompt: string;
};

export interface InitialAnalysisResult extends InspectPointResult {
  thisPoint: string;
  commentText?: string;
  reactComponentName?: string;
  consoleError?: string;
  metadata: AnalysisToolMetadata;
}

program
  .command("initial-analysis")
  .description(
    "Perform initial analysis of a recording. Legacy logic for annotation execution points may run if checkLegacy() returns true."
  )
  .option(
    "-p, --prompt <prompt>",
    "Prompt text, containing recordingId and maybe other relevant data sources."
  )
  .action(initialAnalysisAction);

/** ###########################################################################
 * {@link initialAnalysisAction}
 * ##########################################################################*/

export async function initialAnalysisAction({
  prompt,
}: InitialAnalysisCommandOptions): Promise<void> {
  const { recordingId, point: promptPoint } = scanReplayUrl(prompt);
  if (!recordingId) {
    printCommandError("NoRecordingUrl");
    return;
  }

  const session = await getOrCreateReplaySession(recordingId);

  try {
    const {
      point: analysisPoint,
      commentText,
      reactComponentName,
      consoleError,
    } = await session.runInitialExecutionPointAnalysis(promptPoint);
    const point = analysisPoint || promptPoint;
    if (!point) {
      printCommandError("CouldNotFindInitialPoint");
      return;
    }

    const p = await session.queryPoint(point);
    const pointInfo = await p.inspectPoint();
    const metadata: AnalysisToolMetadata = { recordingId };

    const result: InitialAnalysisResult = {
      thisPoint: point,
      commentText,
      consoleError,
      reactComponentName,
      ...pointInfo,
      metadata,
    };

    printCommandResult(result);
  } finally {
    session?.disconnect();
  }
}
