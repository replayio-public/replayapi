/* Copyright 2020-2024 Record Replay Inc. */

// Mock dependencies before importing them
jest.mock("@replayio/data/src/recordingData/comments");
jest.mock("@replayio/data/src/analysis/runAnalysis");
// jest.mock("@replayio/data/src/gitUtil/LocalGitRepo");
jest.mock("@replayio/data/src/gitUtil/LocalGitRepo", () => {
  const { mockClassMethods } = require("testing/mock-util");
  const Clazz = jest.requireActual("@replayio/data/src/gitUtil/LocalGitRepo").default;
  mockClassMethods(Clazz);
  return {
    __esModule: true,
    default: Clazz,
  };
});
jest.mock("@replayio/data/src/analysis/annotateExecutionPoints", () => ({
  annotateExecutionPoints: jest.fn(),
}));
jest.mock("../commandsShared/print");

import { unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path, { join } from "path";

import { annotateExecutionPoints } from "@replayio/data/src/analysis/annotateExecutionPoints";
import { AnalysisType } from "@replayio/data/src/analysis/dependencyGraphShared";
import { runAnalysis } from "@replayio/data/src/analysis/runAnalysis";
import { ExecutionDataAnalysisResult } from "@replayio/data/src/analysis/specs/executionPoint";
import LocalGitRepo from "@replayio/data/src/gitUtil/LocalGitRepo";

import { printCommandResult } from "../commandsShared/commandOutput";
import { CommandArgs, annotateExecutionPointsAction } from "./annotate-execution-points";

async function runAction(problemDescription: string, options: CommandArgs) {
  const problemDescriptionFile = join(tmpdir(), `problem-${Date.now()}.txt`);

  try {
    await writeFile(problemDescriptionFile, problemDescription, "utf-8");
    return await annotateExecutionPointsAction(problemDescriptionFile, options);
  } finally {
    // Cleanup temp file if needed
    try {
      await unlink(problemDescriptionFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

describe("addExecutionPointComments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should print NoRecordingId when recordingId is not found", async () => {
    const workspacePath = "/path/to/workspace";
    const problemDescription = "This is an issue without recordingId";

    await runAction(problemDescription, {
      workspacePath,
      isWorkspaceRepoPath: true,
    });

    expect(printCommandResult).toHaveBeenCalledWith({ status: "NoRecordingId" });
  });

  it("should print NoPointAndNoSourceComments when no comments with point are found", async () => {
    const workspacePath = "/path/to/workspace";
    const problemDescription =
      "This is an issue with recordingId https://app.replay.io/recording/011f1663-6205-4484-b468-5ec471dc5a31";

    // Mock values.
    const MockAnalysisResults: ExecutionDataAnalysisResult = {
      points: [],
      commentText: "some comment",
    };
    (runAnalysis as jest.MockedFunction<typeof runAnalysis>).mockResolvedValue(MockAnalysisResults);
    (
      annotateExecutionPoints as jest.MockedFunction<typeof annotateExecutionPoints>
    ).mockResolvedValue({ annotatedLocations: [], pointNames: new Map() });

    // Go.
    await runAction(problemDescription, {
      workspacePath,
      isWorkspaceRepoPath: true,
    });

    expect(printCommandResult).toHaveBeenCalledWith({ status: "NoPointAndNoSourceComments" });
  });

  it("should succeed", async () => {
    const repoName = "my-repo";
    const repoUrl = `https://github.com/user/${repoName}.git`;
    const recordingId = "011f1663-6205-4484-b468-5ec471dc5a31";
    const workspacePath = "/path/to/workspace";
    const problemDescription = `This is an issue with recordingId https://app.replay.io/recording/011f1663-6205-4484-b468-5ec471dc5a31 and a github url ${repoUrl}`;
    const repoPath = path.join(workspacePath, repoName);

    // Mock values.
    const MockPoint = "1234";
    const MockAnnotationResult = {
      annotatedLocations: [{ point: MockPoint, file: "file1", line: 1 }],
      pointNames: new Map(),
    };
    const MockAnalysisResults: ExecutionDataAnalysisResult = {
      point: MockPoint,
      points: [],
      reactComponentName: "MyComponent",
      commentText: "comment with point",
    };
    (runAnalysis as jest.MockedFunction<typeof runAnalysis>).mockResolvedValue(MockAnalysisResults);
    (
      annotateExecutionPoints as jest.MockedFunction<typeof annotateExecutionPoints>
    ).mockResolvedValue(MockAnnotationResult);

    // Go.
    await runAction(problemDescription, {
      workspacePath,
      isWorkspaceRepoPath: false,
    });

    // Expect.
    // expect(LocalGitRepo).toHaveBeenCalledWith(workspacePath, false, repoUrl, undefined);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(LocalGitRepo.prototype.init).toHaveBeenCalledWith(false);
    expect(runAnalysis).toHaveBeenCalledWith(
      /* ReplaySession */
      expect.toBeObject(),

      /* AnalysisInput */
      {
        analysisType: AnalysisType.ExecutionPoint,
        spec: {
          recordingId,
        },
      }
    );
    expect(annotateExecutionPoints).toHaveBeenCalledWith({
      repository: repoPath,
      results: MockAnalysisResults,
    });

    const { annotatedLocations } = MockAnnotationResult;
    const startLocation = annotatedLocations.find(l => l.point === MockPoint);
    const startLocationStr = startLocation
      ? `${startLocation.file}:${startLocation.line}`
      : undefined;

    expect(MockAnalysisResults.commentText).toBeString();
    expect(printCommandResult).toHaveBeenCalledWith({
      status: "Success",
      point: MockPoint,
      commentText: MockAnalysisResults.commentText,
      annotatedRepo: repoPath,
      reactComponentName: MockAnalysisResults.reactComponentName,
      annotatedLocations,
      startLocation: startLocationStr,
      startName: MockAnnotationResult.pointNames.get(MockPoint),
    });
  });
});
