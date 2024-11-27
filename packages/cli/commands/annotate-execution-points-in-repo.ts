/* Copyright 2020-2024 Record Replay Inc. */

import { annotateExecutionData } from "@replay/data/src/analysis/annotateRepoWithExecutionPointData";
import { AnalysisType } from "@replay/data/src/analysis/dependency-graph-shared";
import { AnalysisInput } from "@replay/data/src/analysis/dg-specs";
import {
  runAnalysisScript,
} from "@replay/data/src/analysis/run-analysis";
import { GitRepo } from "@replay/data/src/git-util/git-repos";
import { fuzzyExtractRecordingAndPoint } from "@replay/data/src/recording-data/point-treasure-hunt";
import { program } from "commander";

import { printCommandResult } from "../commands-shared/print";

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
): Promise<void> {
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

  const analysisInput: AnalysisInput = {
    analysisType: AnalysisType.ExecutionPoint,
    spec: {
      recordingId,
      point,
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
  // await annotateRepoWithExecutionPointData(repo.folderPath, analysisResults);
  await annotateExecutionData({
    repository: repo.folderPath,
    results: analysisResults,
  });

  printCommandResult({
    status: "Success",
    annotatedRepo: repo.folderPath,
  });
}
