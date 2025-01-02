/* Copyright 2020-2024 Record Replay Inc. */

import { annotateExecutionPoints } from "@replayio/data/src/analysis/annotateExecutionPoints";
import { AnalysisType } from "@replayio/data/src/analysis/dependencyGraphShared";
import { AnalysisInput } from "@replayio/data/src/analysis/dgSpecs";
import { runAnalysis } from "@replayio/data/src/analysis/runAnalysis";
import { ExecutionDataAnalysisResult } from "@replayio/data/src/analysis/specs/executionPoint";
import { scanGitUrl } from "@replayio/data/src/gitUtil/gitStringUtil";
import LocalGitRepo from "@replayio/data/src/gitUtil/LocalGitRepo";
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

import { printCommandResult } from "../../commandsShared/commandOutput";

const debug = createDebug("replay:initial-analysis");

type LegacyCommandArgs = {
  prompt: string;
  workspacePath?: string;
  isWorkspaceRepoPath?: boolean;
  forceDelete?: boolean;
};

type InitialAnalysisCommandOptions = {
  prompt: string;
};

function checkLegacy(recordingId: string | undefined): boolean {
  if (!recordingId) {
    // If we have no recordingId from the problem description, default to new mode.
    return false;
  }

  // If the recordingId is in this array, return false (new mode), else true (legacy mode)
  const newRecordingIds = ["011f1663-6205-4484-b468-5ec471dc5a31"];
  return !newRecordingIds.includes(recordingId);
}

program
  .command("initial-analysis")
  .description(
    "Perform initial analysis of a recording. Legacy logic for annotation execution points may run if checkLegacy() returns true."
  )
  // Legacy options and argument (ignored if not legacy):
  .option("-w, --workspacePath <workspacePath>", "Local file path of the workspace.")
  .option(
    "-i, --isWorkspaceRepoPath",
    "If set, `workspacePath` is path to the repo. Otherwise, it's a parent path.",
    false
  )
  .option("-f, --forceDelete", "Delete the target repo directory if it already exists.", false)
  .option(
    "-p, --prompt <prompt>",
    "Prompt text, containing recordingId and maybe other relevant data sources."
  )
  // New logic requires recording option:
  .action(async (options: LegacyCommandArgs & InitialAnalysisCommandOptions) => {
    // We need a recordingId either from the legacy prompt or from the new mode.
    const { recordingId } = scanReplayUrl(options.prompt);

    if (checkLegacy(recordingId)) {
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
}: LegacyCommandArgs): Promise<void> {
  if (isWorkspaceRepoPath && forceDelete) {
    throw new Error("Cannot use both --is-workspace-repo-path and --force-delete in legacy mode.");
  }
  if (!workspacePath) {
    throw new Error("--workspacePath is required.");
  }
  const { recordingId } = scanReplayUrl(prompt);
  if (!recordingId) {
    printCommandResult({ status: "NoRecordingUrl" });
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
      status: "Success",
      result: {
        thisPoint: point,
        commentText,
        reactComponentName,
        consoleError,
        annotatedRepo: repo.folderPath,
        annotatedLocations,
        startLocation: startLocationStr,
        startName: pointNames.get(point),
      },
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
    printCommandResult({ status: "NoRecordingUrl" });
    return;
  }

  const session = await getOrCreateReplaySession(recordingId);

  try {
    const { point, commentText, reactComponentName, consoleError } = await session.findInitialPoint();
    if (!point) {
      printCommandResult({ status: "CouldNotFindInitialPoint" });
      return;
    }
    if (!commentText) {
      printCommandResult({ status: "CouldNotFindUserCommentInRecording" });
      return;
    }

    const p = await session.queryPoint(point);
    const pointInfo = await p.inspectPoint();

    const result = {
      status: "Success",
      result: {
        thisPoint: point,
        commentText,
        consoleError,
        reactComponentName,
        ...pointInfo,
      },
    };

    printCommandResult(result);
  } finally {
    session?.disconnect();
  }
}
