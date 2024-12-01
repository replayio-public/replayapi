/* Copyright 2020-2024 Record Replay Inc. */

import { readFile } from "fs/promises";
import { debuglog } from "util";

import { annotateExecutionPoints } from "@replay/data/src/analysis/annotateExecutionPoints";
import { AnalysisType } from "@replay/data/src/analysis/dependencyGraphShared";
import { AnalysisInput } from "@replay/data/src/analysis/dgSpecs";
import { runAnalysisExperimentalCommand } from "@replay/data/src/analysis/runAnalysis";
import { GitRepo } from "@replay/data/src/gitUtil/gitRepos";
import { fuzzyExtractRecordingAndPoint } from "@replay/data/src/recordingData/fuzzyPoints";
import ReplaySession from "@replay/data/src/recordingData/ReplaySession";
import { program } from "commander";

import { printCommandResult } from "../commandsShared/print";

const debug = debuglog("replay:annotateExecutionPoints");

/**
 * @see https://linear.app/replay/issue/PRO-904/3-let-oh-fix-the-github-issue-using-brians-10609-solution
 */

program
  .command("annotate-execution-points")
  .description(
    "Analyze recording provided in issueDescription and annotate code at given path with comments." +
      " If it is not a repo yet, then a GitHub URL is extracted from issueDescription for cloning."
  )
  .option("-f --repo-folder-path <repoFolderPath>", "Local file path of the target repo.")
  .option(
    "-a --append-repo-name-to-path",
    "If repoFolderPath is not a git repo, add the name of the repo to the path before cloning.",
    true
  )
  .argument(
    "<issueDescriptionFile>",
    "Path to a file that contains the description of the issue to fix."
  )
  .action(annotateExecutionPointsAction);

export async function annotateExecutionPointsAction(
  issueDescriptionFile: string,
  {
    repoFolderPath,
    appendRepoNameToPath,
  }: { repoFolderPath: string; appendRepoNameToPath: boolean }
): Promise<void> {
  debug(`starting w/ issueDescriptionFile=${JSON.stringify(issueDescriptionFile)}`);

  const issueDescription = await readFile(issueDescriptionFile, "utf8");

  // TODO: Check whether we have to clone.
  // TODO: Extract repoUrl and branchOrCommit from issueDescription.
  // TODO: Respect appendRepoNameToPath
  const repo = new GitRepo(repoUrl, workspaceDir);
  // 4. Clone + checkout branch.
  await repo.init(branchOrCommit);
  // return annotateExecutionPointsAction(issueDescription, { repoFolderPath: repo.folderPath });

  // Extract...
  // 1. recordingId and
  // 2. point from issueDescription and source comments.
  const { recordingId, point } = await fuzzyExtractRecordingAndPoint(issueDescription);
  if (!recordingId) {
    printCommandResult({ status: "NoRecordingId" });
    return;
  }
  if (!point) {
    printCommandResult({ status: "NoSourceComments" });
    return;
  }

  debug(`connecting to Replay server...`);
  const session = new ReplaySession();
  try {
    await session.initialize(recordingId);
    const analysisInput: AnalysisInput = {
      analysisType: AnalysisType.ExecutionPoint,
      spec: {
        recordingId,
        point,
        depth: 2,
      },
    };

    debug(`analyzing recording...`);
    const analysisResults = await runAnalysisExperimentalCommand(session, analysisInput);

    // 5. Run annotation script.
    debug(`annotating repo with analysis results...`);
    await annotateExecutionPoints({
      repository: repoFolderPath,
      results: analysisResults,
    });

    printCommandResult({
      status: "Success",
      annotatedRepo: repoFolderPath,
    });
  } finally {
    session?.disconnect();
  }
}
