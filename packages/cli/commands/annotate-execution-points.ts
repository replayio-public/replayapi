/* Copyright 2020-2024 Record Replay Inc. */

import { readFile } from "fs/promises";
import { debuglog } from "util";

import { annotateExecutionPoints } from "@replayio/data/src/analysis/annotateExecutionPoints";
import { AnalysisType } from "@replayio/data/src/analysis/dependencyGraphShared";
import { AnalysisInput } from "@replayio/data/src/analysis/dgSpecs";
import { runAnalysis } from "@replayio/data/src/analysis/runAnalysis";
import { ExecutionDataAnalysisResult } from "@replayio/data/src/analysis/specs/executionPoint";
import { scanGitUrl } from "@replayio/data/src/gitUtil/gitStringUtil";
import LocalGitRepo from "@replayio/data/src/gitUtil/LocalGitRepo";
import ReplaySession from "@replayio/data/src/recordingData/ReplaySession";
import { scanReplayUrl, scanAnnotationDataUrl } from "@replayio/data/src/recordingData/replayStringUtil";
import { assert } from "@replayio/data/src/util/assert";
import { program } from "commander";

import { printCommandResult } from "../commandsShared/print";

const debug = debuglog("replay:annotateExecutionPoints");

/**
 * @see https://linear.app/replay/issue/PRO-904/3-let-oh-fix-the-github-issue-using-brians-10609-solution
 */

program
  .command("annotate-execution-points")
  .description(
    "Analyze recording provided in problemDescription and annotate code at given path with comments." +
      " If it is not a repo yet, then a GitHub URL is extracted from problemDescription for cloning."
  )
  .option("-w --workspace-path <workspacePath>", "Local file path of the workspace.")
  .option(
    "-i --is-workspace-repo-path",
    "Whether `workspacePath` is the path to the repo. If not, it is considered the parent path. In that case, we add the name of the repo to the path before cloning.",
    false
  )
  .option(
    "-f --force-delete",
    "Whether to delete the target repo directory if it already exists.",
    false
  )
  .argument(
    "<problemDescriptionFile>",
    "Path to a file that contains the description of the issue to fix."
  )
  .action(annotateExecutionPointsAction);

export type CommandArgs = {
  workspacePath: string;
  isWorkspaceRepoPath?: boolean;
  forceDelete?: boolean;
};

async function getAnalysisResults(session: ReplaySession, recordingId: string, annotationDataUrl: string | undefined): Promise<ExecutionDataAnalysisResult> {
  if (!annotationDataUrl) {
    // Initialize session.
    debug(`connecting to Replay server...`);
    await session.initialize(recordingId);
    const analysisInput: AnalysisInput = {
      analysisType: AnalysisType.ExecutionPoint,
      spec: { recordingId },
    };

    // Analyze recording.
    debug(`analyzing recording...`);
    return runAnalysis(session, analysisInput);
  }

  // Download from URL.
  const response = await fetch(annotationDataUrl);
  const data = await response.json() as ExecutionDataAnalysisResult;

  // Sanity check.
  assert(data.points, "No points found in annotation data");

  return data;
}

export async function annotateExecutionPointsAction(
  problemDescriptionFile: string,
  { workspacePath, isWorkspaceRepoPath, forceDelete }: CommandArgs
): Promise<void> {
  if (isWorkspaceRepoPath && forceDelete) {
    // Sanity check.
    throw new Error("Cannot use both --is-workspace-repo-path and --force-delete.");
  }

  // Start...
  debug(`starting w/ problemDescriptionFile=${JSON.stringify(problemDescriptionFile)}`);

  const problemDescription = await readFile(problemDescriptionFile, "utf8");

  // Extract...
  // 1a. recordingId from problemDescription.
  const { recordingId } = scanReplayUrl(problemDescription);
  // 1b. (optional) GitHub url from problemDescription.
  const { repoUrl, branch, commit, tag } = scanGitUrl(problemDescription) || {};
  // 1c. (optional) annotation data from problemDescription.
  const annotationDataUrl = scanAnnotationDataUrl(problemDescription);

  if (!recordingId) {
    printCommandResult({ status: "NoRecordingId" });
    return;
  }

  const session = new ReplaySession();
  try {
    const treeish = branch || commit || tag;
    const repo = new LocalGitRepo(workspacePath, !!isWorkspaceRepoPath, repoUrl, treeish);

    // Clone + checkout branch if necessary.
    await repo.init(!!forceDelete);

    // Hard reset.
    //   NOTE: We should not hard-reset without user consent; but without it we run the risk of getting stuck.
    await repo.hardReset();

    const analysisResults = await getAnalysisResults(session, recordingId, annotationDataUrl);

    const { point, commentText, reactComponentName, consoleError } = analysisResults;
    assert(point, "No point found in analysis results");

    // Run annotation script.
    debug(`annotating repo with analysis results...`);
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
      point,
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
