/* Copyright 2020-2024 Record Replay Inc. */

// Mock dependencies before importing them
jest.mock("@replay/data/src/recordingData/comments");
jest.mock("@replay/data/src/analysis/runAnalysis");
// jest.mock("@replay/data/src/gitUtil/LocalGitRepo");
jest.mock("@replay/data/src/gitUtil/LocalGitRepo", () => {
  const { mockClassMethods } = require("testing/mock-util");
  const Clazz = jest.requireActual("@replay/data/src/gitUtil/LocalGitRepo").default;
  mockClassMethods(Clazz);
  return {
    __esModule: true,
    default: Clazz,
  };
});
jest.mock("@replay/data/src/analysis/annotateExecutionPoints", () => ({
  annotateExecutionPoints: jest.fn(),
}));
jest.mock("../commandsShared/print");

import { unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path, { join } from "path";

import { annotateExecutionPoints } from "@replay/data/src/analysis/annotateExecutionPoints";
import { AnalysisType } from "@replay/data/src/analysis/dependencyGraphShared";
import { runAnalysis } from "@replay/data/src/analysis/runAnalysis";
import LocalGitRepo from "@replay/data/src/gitUtil/LocalGitRepo";
import { RecordingComment, getSourceCodeComments } from "@replay/data/src/recordingData/comments";

import { printCommandResult } from "../commandsShared/print";
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

    await runAction(problemDescription, {
      workspacePath,
      isWorkspaceRepoPath: true,
    });

    expect(printCommandResult).toHaveBeenCalledWith({ status: "NoPointAndNoSourceComments" });
  });

  it("should succeed", async () => {
    const workspacePath = "/path/to/workspace";
    const repoName = "my-repo";
    const repoUrl = `https://github.com/user/${repoName}.git`;
    const problemDescription = `This is an issue with recordingId https://app.replay.io/recording/011f1663-6205-4484-b468-5ec471dc5a31 and a github url ${repoUrl}`;

    const recordingId = "011f1663-6205-4484-b468-5ec471dc5a31";
    const point = "1234";
    const analysisResults = { points: ["point1"] };
    const repoPath = path.join(workspacePath, repoName);

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

    (runAnalysis as jest.MockedFunction<typeof runAnalysis>).mockResolvedValue(analysisResults);

    (
      annotateExecutionPoints as jest.MockedFunction<typeof annotateExecutionPoints>
    ).mockResolvedValue(undefined);

    // Go.
    await runAction(problemDescription, {
      workspacePath,
      isWorkspaceRepoPath: false,
    });

    // Expect.
    // expect(LocalGitRepo).toHaveBeenCalledWith(workspacePath, false, repoUrl, undefined);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(LocalGitRepo.prototype.init).toHaveBeenCalledWith();
    expect(runAnalysis).toHaveBeenCalledWith(
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
    expect(annotateExecutionPoints).toHaveBeenCalledWith({
      repository: repoPath,
      results: analysisResults,
    });
    expect(printCommandResult).toHaveBeenCalledWith({
      status: "Success",
      annotatedRepo: repoPath,
    });
  });
});
