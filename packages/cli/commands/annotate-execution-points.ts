/* Copyright 2020-2024 Record Replay Inc. */

import { readFile } from "fs/promises";
import createDebug from 'debug';

import { annotateExecutionPoints } from "@replayio/data/src/analysis/annotateExecutionPoints";
import { AnalysisType } from "@replayio/data/src/analysis/dependencyGraphShared";
import { AnalysisInput } from "@replayio/data/src/analysis/dgSpecs";
import { runAnalysis } from "@replayio/data/src/analysis/runAnalysis";
import { ExecutionDataAnalysisResult } from "@replayio/data/src/analysis/specs/executionPoint";
import { scanGitUrl } from "@replayio/data/src/gitUtil/gitStringUtil";
import LocalGitRepo from "@replayio/data/src/gitUtil/LocalGitRepo";
import ReplaySession, { getOrCreateReplaySession } from "@replayio/data/src/recordingData/ReplaySession";
import { scanReplayUrl } from "@replayio/data/src/recordingData/replayStringUtil";
import { assert } from "@replayio/data/src/util/assert";
import { program } from "commander";

import { printCommandResult } from "../commandsShared/print";

const debug = createDebug("replay:annotate-execution-points");

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
  let { recordingId } = scanReplayUrl(problemDescription);
  // 1b. (optional) GitHub url from problemDescription.
  const { repoUrl, branch, commit, tag } = scanGitUrl(problemDescription) || {};

  if (!recordingId) {
    printCommandResult({ status: "NoRecordingId" });
    return;
  }

  let session: ReplaySession | undefined;
  try {
    const treeish = branch || commit || tag;
    const repo = new LocalGitRepo(workspacePath, !!isWorkspaceRepoPath, repoUrl, treeish);

    // 4. Clone + checkout branch if necessary.
    await repo.init(!!forceDelete);

    // 4b. Hard reset.
    //     NOTE: We should not hard-reset without user consent; but without it we run the risk of getting stuck.
    await repo.hardReset();

    // 5. Initialize session.
    debug(`connecting to Replay server...`);
    const session = await getOrCreateReplaySession(recordingId);
    const analysisInput: AnalysisInput = {
      analysisType: AnalysisType.ExecutionPoint,
      spec: { recordingId },
    };

    // 6. Analyze recording.
    debug(`analyzing recording...`);
    const analysisResults = await runAnalysis(session, analysisInput) as ExecutionDataAnalysisResult;

    const { point, commentText, reactComponentName } = analysisResults;
    assert(point, "No point found in analysis results");
    assert(commentText, "No comment text found in analysis results");

    // 7. Run annotation script.
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
      annotatedRepo: repo.folderPath,
      annotatedLocations,
      startLocation: startLocationStr,
      startName: pointNames.get(point),
    });
  } finally {
    session?.disconnect();
  }
}
