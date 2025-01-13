/* Copyright 2020-2024 Record Replay Inc. */
export const GitHubPatterns = {
  REPO_URL:
    /((?:https:\/\/|git@)github\.com(?:[:/])(?<owner>[^/\s]+)\/(?<repo>[^/\s#?:.]+)(?:\.git)?)(?<!:\]\))[^\s]*/,
  BRANCH: /\/(?:tree|blob|branch)\/([^\s#?:]+)/,
  COMMIT: /\/commit\/([0-9a-fA-F]{7,40})/,
  TAG: /\/(?:releases\/tag|tree|tags)\/([^/\s#?:]+)/,
};

export function extractRepoFolderName(url: string): string | null {
  const match = GitHubPatterns.REPO_URL.exec(url);
  return match?.groups?.["repo"] || null;
}

export type GitHubParseResult =
  | {
      repoUrl: string;
      owner: string;
      repo: string; // Name of the repo (without owner).
      branch?: string;
      commit?: string;
      tag?: string;
    }
  | undefined;

export function scanGitUrl(text: string): GitHubParseResult {
  const repoMatch = GitHubPatterns.REPO_URL.exec(text);
  if (repoMatch) {
    const baseUrl = repoMatch[0];
    const result: ReturnType<typeof scanGitUrl> = {
      repoUrl: repoMatch[1]!,
      owner: repoMatch.groups!["owner"]!,
      repo: repoMatch.groups!["repo"]!,
    };

    const branchMatch = GitHubPatterns.BRANCH.exec(baseUrl);
    if (branchMatch) {
      result.branch = branchMatch[1];
    }

    const commitMatch = GitHubPatterns.COMMIT.exec(baseUrl);
    if (commitMatch) {
      result.commit = commitMatch[1];
    }

    const tagMatch = GitHubPatterns.TAG.exec(baseUrl);
    if (tagMatch) {
      result.tag = tagMatch[1];
    }
    return result;
  }
  return undefined;
}
