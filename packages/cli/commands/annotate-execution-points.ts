/* Copyright 2020-2024 Record Replay Inc. */

import { readFile } from "fs/promises";
import { debuglog } from "util";

import { annotateExecutionPoints } from "@replay/data/src/analysis/annotateExecutionPoints";
import { AnalysisType } from "@replay/data/src/analysis/dependencyGraphShared";
import { AnalysisInput } from "@replay/data/src/analysis/dgSpecs";
import { runAnalysis } from "@replay/data/src/analysis/runAnalysis";
import { scanGitUrl } from "@replay/data/src/gitUtil/gitStringUtil";
import LocalGitRepo from "@replay/data/src/gitUtil/LocalGitRepo";
import ReplaySession from "@replay/data/src/recordingData/ReplaySession";
import { scanRecordingAndPoint } from "@replay/data/src/recordingData/replayStringUtil";
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
    "`workspacePath` itself is the repo. If not, add the name of the repo to the path before cloning.",
    false
  )
  .argument(
    "<problemDescriptionFile>",
    "Path to a file that contains the description of the issue to fix."
  )
  .action(annotateExecutionPointsAction);

export type CommandArgs = { workspacePath: string; isWorkspaceRepoPath: boolean };

export async function annotateExecutionPointsAction(
  problemDescriptionFile: string,
  { workspacePath, isWorkspaceRepoPath = false }: CommandArgs
): Promise<void> {
  debug(`starting w/ problemDescriptionFile=${JSON.stringify(problemDescriptionFile)}`);

  const problemDescription = await readFile(problemDescriptionFile, "utf8");

  // Extract...
  // 1. recordingId and
  // 2. point from problemDescription and source comments.
  const { recordingId, point } = await scanRecordingAndPoint(problemDescription);
  if (!recordingId) {
    printCommandResult({ status: "NoRecordingId" });
    return;
  }
  if (!point) {
    printCommandResult({ status: "NoPointAndNoSourceComments" });
    return;
  }

  const session = new ReplaySession();
  try {
    // Extract possible GitHub url from problemDescription.
    const { repoUrl, branch, commit, tag } = scanGitUrl(problemDescription);
    const treeish = branch || commit || tag;

    const repo = new LocalGitRepo(workspacePath, !!isWorkspaceRepoPath, repoUrl, treeish);
    // 4. Clone + checkout branch if necessary.
    await repo.init();

    // 5. Initialize session.
    debug(`connecting to Replay server...`);
    await session.initialize(recordingId);
    const analysisInput: AnalysisInput = {
      analysisType: AnalysisType.ExecutionPoint,
      spec: {
        recordingId,
        point,
        depth: 2,
      },
    };

    // 6. Analyze recording.
    debug(`analyzing recording...`);
    const analysisResults = await runAnalysis(session, analysisInput);

    // 7. Run annotation script.
    debug(`annotating repo with analysis results...`);
    await annotateExecutionPoints({
      repository: repo.folderPath,
      results: analysisResults,
    });

    printCommandResult({
      status: "Success",
      annotatedRepo: repo.folderPath,
    });
  } finally {
    session?.disconnect();
  }
}
