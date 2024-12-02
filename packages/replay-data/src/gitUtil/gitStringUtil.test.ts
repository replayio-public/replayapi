/* Copyright 2020-2024 Record Replay Inc. */

import { extractRepoFolderName, scanGitUrl } from "./gitStringUtil";

describe("extractRepoFolderName", () => {
  test("extracts repo name from HTTPS URL", () => {
    expect(extractRepoFolderName("https://github.com/user/repo")).toBe("repo");
    expect(extractRepoFolderName("https://github.com/user/repo.git")).toBe("repo");
    expect(extractRepoFolderName("https://github.com/user/repo#branch")).toBe("repo");
  });

  test("extracts repo name from SSH URL", () => {
    expect(extractRepoFolderName("git@github.com:user/repo")).toBe("repo");
    expect(extractRepoFolderName("git@github.com:user/repo:")).toBe(null);
    expect(extractRepoFolderName("git@github.com:user/repo.git")).toBe("repo");
  });

  test("returns null for invalid URLs", () => {
    expect(extractRepoFolderName("invalid-url")).toBeNull();
    expect(extractRepoFolderName("")).toBeNull();
    expect(extractRepoFolderName("github.com/only-user")).toBeNull();
  });
});

describe("scanGitUrl", () => {
  test("parses HTTPS repository URL", () => {
    const result = scanGitUrl("https://github.com/user/repo");
    expect(result.repoUrl).toBe("https://github.com/user/repo");
    expect(result.branch).toBeUndefined();
  });

  test("parses SSH repository URL", () => {
    const result = scanGitUrl("git@github.com:user/repo.git");
    expect(result.repoUrl).toBe("git@github.com:user/repo.git");
    expect(result.branch).toBeUndefined();
  });

  test("extracts branch information", () => {
    const result = scanGitUrl("https://github.com/user/repo/tree/main");
    expect(result.repoUrl).toBe("https://github.com/user/repo");
    expect(result.branch).toBe("main");
  });

  test("extracts commit hash", () => {
    const result = scanGitUrl("https://github.com/user/repo/commit/1234567");
    expect(result.repoUrl).toBe("https://github.com/user/repo");
    expect(result.commit).toBe("1234567");
  });

  test("extracts tag information", () => {
    const result = scanGitUrl("https://github.com/user/repo/tags/v1.0.0");
    expect(result.repoUrl).toBe("https://github.com/user/repo");
    expect(result.tag).toBe("v1.0.0");
  });

  test("handles complex URLs with multiple components", () => {
    const result = scanGitUrl("https://github.com/user/repo/tree/feature/branch");
    expect(result.repoUrl).toBe("https://github.com/user/repo");
    expect(result.branch).toBe("feature/branch");
  });

  test("returns empty object for invalid URLs", () => {
    const result = scanGitUrl("invalid-url");
    expect(result).toEqual({});
  });
});
