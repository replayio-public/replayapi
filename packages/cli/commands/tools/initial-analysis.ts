/* Copyright 2020-2024 Record Replay Inc. */

import { annotateExecutionPoints } from "@replayio/data/src/analysis/annotateExecutionPoints";
import { AnalysisType } from "@replayio/data/src/analysis/dependencyGraphShared";
import { AnalysisInput } from "@replayio/data/src/analysis/dgSpecs";
import { runAnalysis } from "@replayio/data/src/analysis/runAnalysis";
import { ExecutionDataAnalysisResult } from "@replayio/data/src/analysis/specs/executionPoint";
import { scanGitUrl } from "@replayio/data/src/gitUtil/gitStringUtil";
import LocalGitRepo from "@replayio/data/src/gitUtil/LocalGitRepo";
import { InspectPointResult } from "@replayio/data/src/recordingData/PointQueries";
import ReplaySession, {
  getOrCreateReplaySession,
} from "@replayio/data/src/recordingData/ReplaySession";
import {
  scanAnnotationDataUrl,
  scanReplayUrl,
} from "@replayio/data/src/recordingData/replayStringUtil";
import { assert } from "@replayio/data/src/util/assert";
import { program } from "commander";
import createDebug from "debug";

import { printCommandError, printCommandResult } from "../../commandsShared/commandOutput";
import { AnalysisToolMetadata } from "./tools-shared";

const debug = createDebug("replay:initial-analysis");

type LegacyOptions = {
  prompt: string;
  workspacePath?: string;
  isWorkspaceRepoPath?: boolean;
  forceDelete?: boolean;
};

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

const NewRecordingIds = ["011f1663-6205-4484-b468-5ec471dc5a31", "7dfc5103-8060-4128-a1b6-20d0a56aadcc"];
function shouldUseLegacyMode(recordingId: string | undefined): boolean {
  if (!recordingId) {
    // If we have no recordingId from the problem description, default to new mode.
    return false;
  }

  // If the recordingId is in the array, return false (new mode), else true (legacy mode)
  return !NewRecordingIds.includes(recordingId);
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

  // Legacy options (ignored when not legacy).
  .option("-w, --workspacePath <workspacePath>", "Local file path of the workspace.", false)
  .option(
    "-i, --isWorkspaceRepoPath",
    "If set, `workspacePath` is path to the repo. Otherwise, it's a parent path.",
    false
  )
  .option("-f, --forceDelete", "Delete the target repo directory if it already exists.", false)
  
  // Action handler.
  .action(async (options: InitialAnalysisCommandOptions & LegacyOptions) => {
    // We need a recordingId either from the legacy prompt or from the new mode.
    const { recordingId } = scanReplayUrl(options.prompt);

    if (shouldUseLegacyMode(recordingId)) {
      // Run old, more exhaustive, annotate-execution-points logic
      await annotateExecutionPointsAction(options);
    } else {
      // Run new initial-analysis logic.
      await initialAnalysisAction(options);
    }
  });

/** ###########################################################################
 * {@link annotateExecutionPointsAction}
 * ##########################################################################*/

async function getOrFetchExecutionPointAnalysis(
  session: ReplaySession,
  recordingId: string,
  annotationDataUrl: string | undefined
): Promise<ExecutionDataAnalysisResult> {
  if (!annotationDataUrl) {
    const analysisInput: AnalysisInput = {
      analysisType: AnalysisType.ExecutionPoint,
      spec: { recordingId },
    };

    debug(`analyzing recording (legacy mode)...`);
    return runAnalysis(session, analysisInput);
  }

  // Download from URL.
  const response = await fetch(annotationDataUrl);
  const data = (await response.json()) as ExecutionDataAnalysisResult;
  assert(data.points, "No points found in annotation data");

  return data;
}

async function annotateExecutionPointsAction({
  prompt,
  workspacePath,
  isWorkspaceRepoPath,
  forceDelete,
}: LegacyOptions): Promise<void> {
  if (isWorkspaceRepoPath && forceDelete) {
    throw new Error("Cannot use both --is-workspace-repo-path and --force-delete in legacy mode.");
  }
  if (!workspacePath) {
    throw new Error("--workspacePath is required.");
  }
  const { recordingId } = scanReplayUrl(prompt);
  if (!recordingId) {
    printCommandError("NoRecordingUrl");
    return;
  }
  const annotationDataUrl = scanAnnotationDataUrl(prompt);
  const { repoUrl, branch, commit, tag } = scanGitUrl(prompt) || {};

  const session = await getOrCreateReplaySession(recordingId);

  try {
    const treeish = branch || commit || tag;
    const repo = new LocalGitRepo(workspacePath, !!isWorkspaceRepoPath, repoUrl, treeish);

    // Clone + checkout branch if necessary.
    await repo.init(!!forceDelete);
    await repo.hardReset();

    const analysisResults = await getOrFetchExecutionPointAnalysis(
      session,
      recordingId,
      annotationDataUrl
    );
    const { point, commentText, reactComponentName, consoleError } = analysisResults;
    assert(point, "No point found in analysis results");
    assert(typeof commentText == "string", "No comment text found in analysis results");

    debug(`annotating repo with analysis results (legacy mode)...`);
    const { annotatedLocations, pointNames } = await annotateExecutionPoints({
      repository: repo.folderPath,
      results: analysisResults,
    });

    const startLocation = annotatedLocations.find(l => l.point === point);
    const startLocationStr = startLocation
      ? `${startLocation.file}:${startLocation.line}`
      : undefined;

    printCommandResult({
      thisPoint: point,
      commentText,
      reactComponentName,
      consoleError,
      annotatedRepo: repo.folderPath,
      annotatedLocations,
      startLocation: startLocationStr,
      startName: pointNames.get(point),
    });
  } finally {
    session?.disconnect();
  }
}

/** ###########################################################################
 * {@link initialAnalysisAction}
 * ##########################################################################*/

export async function initialAnalysisAction({
  prompt,
}: InitialAnalysisCommandOptions): Promise<void> {
  const { recordingId } = scanReplayUrl(prompt);
  if (!recordingId) {
    printCommandError("NoRecordingUrl");
    return;
  }

  const session = await getOrCreateReplaySession(recordingId);

  try {
    const { point, commentText, reactComponentName, consoleError } =
      await session.findInitialPoint();
    if (!point) {
      printCommandError("CouldNotFindInitialPoint");
      return;
    }
    if (!commentText) {
      printCommandError("CouldNotFindUserCommentInRecording");
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
