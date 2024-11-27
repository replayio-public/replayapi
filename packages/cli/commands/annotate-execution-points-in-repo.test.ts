/* Copyright 2020-2024 Record Replay Inc. */

// Mock dependencies before importing them
jest.mock("@replay/data/src/recording-data/comments");
jest.mock("@replay/data/src/analysis/run-analysis");
jest.mock("@replay/data/src/git-util/github-issue");
jest.mock("@replay/data/src/git-util/git-repos");
// mock annotateExecutionData
jest.mock("@replay/data/src/analysis/annotateRepoWithExecutionPointData.ts", () => ({
  annotateExecutionData: jest.fn(),
}));
jest.mock("../commands-shared/print");

import { annotateExecutionData } from "@replay/data/src/analysis/annotateRepoWithExecutionPointData";
import { AnalysisType } from "@replay/data/src/analysis/dependency-graph-shared";
import { runAnalysisScript } from "@replay/data/src/analysis/run-analysis";
import { RecordingComment, getSourceCodeComments } from "@replay/data/src/recording-data/comments";

import { GitRepo } from "../../replay-data/src/git-util/git-repos";
import { scanRecordingId } from "../../replay-data/src/git-util/github-issue";
import { printCommandResult } from "../commands-shared/print";
import { addExecutionPointComments } from "./annotate-execution-points-in-repo";

describe("addExecutionPointComments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should print NoRecordingId when recordingId is not found", async () => {
    const workspaceDir = "/path/to/workspace";
    const repoUrl = "https://github.com/user/repo.git";
    const branchOrCommit = "main";
    const issueDescription = "This is an issue without recordingId";
    const recordingId = null;

    const scanRecordingIdMock = scanRecordingId as jest.MockedFunction<typeof scanRecordingId>;
    scanRecordingIdMock.mockReturnValue(recordingId);

    await addExecutionPointComments(workspaceDir, repoUrl, branchOrCommit, issueDescription);

    expect(printCommandResult).toHaveBeenCalledWith({ status: "NoRecordingId" });
  });

  it("should print NoSourceComments when no comments with point are found", async () => {
    const workspaceDir = "/path/to/workspace";
    const repoUrl = "https://github.com/user/repo.git";
    const branchOrCommit = "main";
    const issueDescription = "This is an issue with recordingId abc123";
    const recordingId = "abc123";

    const scanRecordingIdMock = scanRecordingId as jest.MockedFunction<typeof scanRecordingId>;
    scanRecordingIdMock.mockReturnValue(recordingId);

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

    await addExecutionPointComments(workspaceDir, repoUrl, branchOrCommit, issueDescription);

    expect(printCommandResult).toHaveBeenCalledWith({ status: "NoSourceComments" });
  });

  it("should succeed when all steps pass", async () => {
    const workspaceDir = "/path/to/workspace";
    const repoUrl = "https://github.com/user/repo.git";
    const branchOrCommit = "main";
    const issueDescription = "This is an issue with recordingId abc123";

    const recordingId = "abc123";
    const point = "1234";
    const analysisResults = { points: ["point1"] };
    const folderPath = "/path/to/workspace/repo";

    (scanRecordingId as jest.MockedFunction<typeof scanRecordingId>).mockReturnValue(recordingId);

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

    (annotateExecutionData as jest.MockedFunction<typeof annotateExecutionData>).mockResolvedValue(
      undefined
    );

    // Mock GitRepo class
    const gitRepoInitMock = jest.fn().mockResolvedValue(undefined);
    (GitRepo as jest.Mock).mockImplementation(() => ({
      folderPath,
      init: gitRepoInitMock,
    }));

    await addExecutionPointComments(workspaceDir, repoUrl, branchOrCommit, issueDescription);

    expect(runAnalysisScript).toHaveBeenCalledWith({
      analysisType: AnalysisType.ExecutionPoint,
      spec: {
        recordingId,
        point,
        depth: 2,
      },
    });
    expect(GitRepo).toHaveBeenCalledWith(repoUrl, workspaceDir);
    expect(gitRepoInitMock).toHaveBeenCalledWith(branchOrCommit);
    const annotateSpec = {
      repository: folderPath,
      results: analysisResults,
    };
    expect(annotateExecutionData).toHaveBeenCalledWith(annotateSpec);
    expect(printCommandResult).toHaveBeenCalledWith({
      status: "Success",
      annotatedRepo: folderPath,
    });
  });
});
