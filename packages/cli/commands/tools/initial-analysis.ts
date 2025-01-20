/* Copyright 2020-2024 Record Replay Inc. */

import { getOrCreateReplaySession } from "@replayio/data/src/recordingData/ReplaySession";
import { scanReplayUrl } from "@replayio/data/src/recordingData/replayStringUtil";
import { DependencyEventNode, InspectPointResult } from "@replayio/data/src/recordingData/types";
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
    const { point: analysisPoint, ...initialAnalysisData } =
      await session.runInitialExecutionPointAnalysis(promptPoint);
    let point = analysisPoint || promptPoint;
    if (!point) {
      printCommandError("CouldNotFindInitialPoint");
      return;
    }

    // NOTE: For initialAnalysis we ignore third party code, for now.
    let p = await session.queryPoint(point);

    const { failureData } = initialAnalysisData;
    if (failureData) {
      if (failureData.calleeFrame) {
        failureData.IMPORTANT_NOTES =
          "An exception is being thrown from hidden third-party code down-stack from here.";
        delete failureData.errorText; // `errorText` is confusing in the given context.
      } else {
        failureData.IMPORTANT_NOTES = "An exception is being thrown from user code on this stack.";
      }
      delete failureData.calleeFrame; // `calleeFrame` is hard to interpret by the agent.
      failureData.IMPORTANT_NOTES +=
        " This is a severe problem that crashes the app. FIXING THIS is the top priority: The application MUST work and NEVER crash. It is Ok to remove or weaken feature code to fix this. Adding `ErrorBoundary` does not fix this.";
    }

    // // Experiment: Focus on user code first. But then the error message does not match the point.
    // const firstUserCodePoint = await p.getFirstUserCodePointOnStack();
    // if (firstUserCodePoint) {
    //   if (initialAnalysisData.failureData?.point === point) {
    //     // Fix up nested point as well.
    //     // initialAnalysisData.failureData.point = firstUserCodePoint;
    //     initialAnalysisData.failureData.point = omitPoint("third-party");
    //   }
    //   // Use this point instead.
    //   point = firstUserCodePoint;
    //   p = await session.queryPoint(point);
    // }

    // Inspect the point.
    const pointInfo = await p.inspectPoint();

    // Supplement missing dependency data for nodes with children.
    const nodesWithChildren = Object.values(initialAnalysisData).filter(
      o => o && typeof o === "object" && "children" in o
    );
    await Promise.all(
      nodesWithChildren.map(n => p.supplementMissingDependencyData(n as DependencyEventNode))
    );

    // Prepare metadata.
    const metadata: AnalysisToolMetadata = { recordingId };

    // Final result.
    const result: InitialAnalysisResult = {
      thisPoint: point,
      ...initialAnalysisData,
      ...pointInfo,
      metadata,
    };
    printCommandResult(result);
  } finally {
    session?.disconnect();
  }
}
