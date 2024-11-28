/* Copyright 2020-2024 Record Replay Inc. */

import { annotateExecutionPoints } from "@replay/data/src/analysis/annotateExecutionPoints";
import { AnalysisType } from "@replay/data/src/analysis/dependencyGraphShared";
import { AnalysisInput } from "@replay/data/src/analysis/dgSpecs";
import {
  runAnalysisExperimentalCommand,
} from "@replay/data/src/analysis/runAnalysis";
import { GitRepo } from "@replay/data/src/gitUtil/gitRepos";
import { fuzzyExtractRecordingAndPoint } from "@replay/data/src/recordingData/fuzzyPoints";
import ReplaySession from "@replay/data/src/recordingData/ReplaySession";
import { program } from "commander";

import { printCommandResult } from "../commandsShared/print";

/**
 * @see https://linear.app/replay/issue/PRO-904/3-let-oh-fix-the-github-issue-using-brians-10609-solution
 */
program
  .command("annotate-execution-points")
  .description(
    "Analyze a recording based on recording comments. Add analysis results into the code as comments."
  )
  // .option("-y, --dry-run", "Whether to only analyze, but not commit any changes.")
  .argument("<workspaceDir>", "Local file path to workspace, that the agent has access to.")
  .argument("<repoUrl>", "URL of the repository to analyze.")
  .argument("<branchOrCommit>", "Branch or commit to analyze.")
  .argument("<issueDescription>", "Description of the issue to fix.")
  .action(annotateExecutionPointsAction);

export async function annotateExecutionPointsAction(
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

  const session = new ReplaySession();
  await session.initialize(recordingId);
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
    runAnalysisExperimentalCommand(session, analysisInput),
    // 4. Clone + checkout branch.
    repo.init(branchOrCommit),
  ]);

  // 5. Run annotation script.
  // await annotateRepoWithExecutionPointData(repo.folderPath, analysisResults);
  await annotateExecutionPoints({
    repository: repo.folderPath,
    results: analysisResults,
  });

  printCommandResult({
    status: "Success",
    annotatedRepo: repo.folderPath,
  });
}
