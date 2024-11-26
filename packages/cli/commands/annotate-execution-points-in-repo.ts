/* Copyright 2020-2024 Record Replay Inc. */

import { AnalysisType } from "@replay/data/src/backend-wrapper/analysis/dependency-graph-shared";
import { AnalysisInput } from "@replay/data/src/backend-wrapper/analysis/dg-specs";
import {
  annotateRepoWithExecutionPointData,
  runAnalysisScript,
} from "@replay/data/src/backend-wrapper/analysis/run-analysis";
import { getSourceCodeComments } from "@replay/data/src/recording-data/comments";
import { program } from "commander";

import { printCommandResult } from "../commands-shared/print";
import { GitRepo } from "../git-util/git-repos";
import { scanRecordingId } from "../git-util/github-issue";

/**
 * @see https://linear.app/replay/issue/PRO-904/3-let-oh-fix-the-github-issue-using-brians-10609-solution
 */
program
  .command("annotate-execution-points-in-repo")
  .description(
    "Analyze a recording based on recording comments. Add analysis results into the code as comments."
  )
  // .option("-y, --dry-run", "Whether to only analyze, but not commit any changes.")
  .argument("<workspaceDir>", "Local file path to workspace, that the agent has access to.")
  .argument("<repoUrl>", "URL of the repository to analyze.")
  .argument("<branchOrCommit>", "Branch or commit to analyze.")
  .argument("<issueDescription>", "Description of the issue to fix.")
  .action(addExecutionPointComments);

export async function addExecutionPointComments(
  workspaceDir: string,
  repoUrl: string,
  branchOrCommit: string,
  issueDescription: string
  // opts: any
): Promise<void> {
  // const { dryRun } = opts;

  // 1. Extract recordingId from issue.
  const recordingId = scanRecordingId(issueDescription);
  if (!recordingId) {
    printCommandResult({ status: "NoRecordingId" });
    return;
  }

  // 2. Get first source comment with a point.
  //    NOTE: All source comments should have a point.
  const comment = (await getSourceCodeComments(recordingId)).find(c => c.point);
  if (!comment) {
    printCommandResult({ status: "NoSourceComments" });
    return;
  }

  const analysisInput: AnalysisInput = {
    analysisType: AnalysisType.ExecutionPoint,
    spec: {
      recordingId,
      point: comment.point,
      depth: 2,
    },
  };
  const repo = new GitRepo(repoUrl, workspaceDir);

  const [analysisResults] = await Promise.all([
    // 3. Get analysis results for the point.
    runAnalysisScript(analysisInput),
    // 4. Clone + checkout branch.
    repo.init(branchOrCommit),
  ]);

  // 5. Run annotation script.
  await annotateRepoWithExecutionPointData(repo.folderPath, analysisResults);

  printCommandResult({
    status: "Success",
    annotatedRepo: repo.folderPath,
  });
}
