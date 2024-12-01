/* Copyright 2020-2024 Record Replay Inc. */

// Mock dependencies before importing them
jest.mock("@replay/data/src/recordingData/comments");
jest.mock("@replay/data/src/analysis/runAnalysis");
jest.mock("@replay/data/src/gitUtil/gitRepos");
jest.mock("@replay/data/src/analysis/annotateExecutionPoints", () => ({
  annotateExecutionPoints: jest.fn(),
}));
jest.mock("../commandsShared/print");

import { annotateExecutionPoints } from "@replay/data/src/analysis/annotateExecutionPoints";
import { AnalysisType } from "@replay/data/src/analysis/dependencyGraphShared";
import {
  runAnalysisExperimentalCommand,
  runAnalysisScript,
} from "@replay/data/src/analysis/runAnalysis";
import { RecordingComment, getSourceCodeComments } from "@replay/data/src/recordingData/comments";

import { GitRepo } from "../../replay-data/src/gitUtil/gitRepos";
import { printCommandResult } from "../commandsShared/print";
import { annotateExecutionPointsAction } from "./annotate-execution-points";

describe("addExecutionPointComments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should print NoRecordingId when recordingId is not found", async () => {
    const workspaceDir = "/path/to/workspace";
    const repoUrl = "https://github.com/user/repo.git";
    const branchOrCommit = "main";
    const issueDescription = "This is an issue without recordingId";

    await annotateExecutionPointsAction(issueDescription, {
      workspaceDir,
      repoUrl,
      branchOrCommit,
    });

    expect(printCommandResult).toHaveBeenCalledWith({ status: "NoRecordingId" });
  });

  it("should print NoSourceComments when no comments with point are found", async () => {
    const workspaceDir = "/path/to/workspace";
    const repoUrl = "https://github.com/user/repo.git";
    const branchOrCommit = "main";
    const issueDescription =
      "This is an issue with recordingId https://app.replay.io/recording/011f1663-6205-4484-b468-5ec471dc5a31";

    const mockComments: RecordingComment[] = [
      {
        author: "test-author",
        text: "First comment without point",
        point: null as any,
        type: "source-code",
        createdAt: new Date().toISOString(),
        location: null,
      },
      {
        author: "test-author",
        text: "Second comment without point",
        point: null as any,
        type: "source-code",
        createdAt: new Date().toISOString(),
        location: null,
      },
    ];

    (getSourceCodeComments as jest.MockedFunction<typeof getSourceCodeComments>).mockResolvedValue(
      mockComments
    );

    await annotateExecutionPointsAction(issueDescription, {
      workspaceDir,
      repoUrl,
      branchOrCommit,
    });

    expect(printCommandResult).toHaveBeenCalledWith({ status: "NoSourceComments" });
  });

  it("should succeed", async () => {
    const workspaceDir = "/path/to/workspace";
    const repoUrl = "https://github.com/user/repo.git";
    const branchOrCommit = "main";
    const issueDescription =
      "This is an issue with recordingId https://app.replay.io/recording/011f1663-6205-4484-b468-5ec471dc5a31";

    const recordingId = "011f1663-6205-4484-b468-5ec471dc5a31";
    const point = "1234";
    const analysisResults = { points: ["point1"] };
    const folderPath = "/path/to/workspace/repo";

    const mockComments: RecordingComment[] = [
      {
        author: "test-author",
        text: "Comment with point",
        point: point as any,
        type: "source-code",
        createdAt: new Date().toISOString(),
        location: null,
      },
      {
        author: "test-author",
        text: "Comment without point",
        point: null as any,
        type: "source-code",
        createdAt: new Date().toISOString(),
        location: null,
      },
    ];

    (getSourceCodeComments as jest.MockedFunction<typeof getSourceCodeComments>).mockResolvedValue(
      mockComments
    );

    (runAnalysisScript as jest.MockedFunction<typeof runAnalysisScript>).mockResolvedValue(
      analysisResults
    );

    (
      annotateExecutionPoints as jest.MockedFunction<typeof annotateExecutionPoints>
    ).mockResolvedValue(undefined);

    // Mock GitRepo class
    const gitRepoInitMock = jest.fn().mockResolvedValue(undefined);
    (GitRepo as jest.Mock).mockImplementation(() => ({
      folderPath,
      init: gitRepoInitMock,
    }));

    await annotateExecutionPointsAction(issueDescription, {
      workspaceDir,
      repoUrl,
      branchOrCommit,
    });

    expect(runAnalysisExperimentalCommand).toHaveBeenCalledWith(
      /* ReplaySession */
      expect.toBeObject(),

      /* AnalysisInput */
      {
        analysisType: AnalysisType.ExecutionPoint,
        spec: {
          recordingId,
          point,
          depth: 2,
        },
      }
    );
    expect(GitRepo).toHaveBeenCalledWith(repoUrl, workspaceDir);
    expect(gitRepoInitMock).toHaveBeenCalledWith(branchOrCommit);
    expect(printCommandResult).toHaveBeenCalledWith({
      status: "Success",
      annotatedRepo: folderPath,
    });
  });
});
