/* Copyright 2020-2024 Record Replay Inc. */
export const GitHubPatterns = {
  REPO_URL:
    /(?:https:\/\/|git@)github\.com[:/](?<owner>[^/\s]+)\/(?<repo>[^/\s#?:.]+?)(?:\.git)?(?=\/|$|[#?])/,
  BRANCH: /\/(?:tree|blob|branch)\/([^\s#?]+)/,
  COMMIT: /\/commit\/([0-9a-fA-F]{7,40})/,
  TAG: /\/(?:releases\/tag|tree|tags)\/([^/\s#?]+)/,
};

export function extractRepoFolderName(url: string): string | null {
  const match = GitHubPatterns.REPO_URL.exec(url);
  return match?.groups?.["repo"] || null;
}

export function scanGitUrl(text: string): {
  repoUrl?: string;
  branch?: string;
  commit?: string;
  tag?: string;
} {
  const result: ReturnType<typeof scanGitUrl> = {};

  const repoMatch = GitHubPatterns.REPO_URL.exec(text);
  if (repoMatch) {
    result.repoUrl = repoMatch[0];
  }

  const branchMatch = GitHubPatterns.BRANCH.exec(text);
  if (branchMatch) {
    result.branch = branchMatch[1];
  }

  const commitMatch = GitHubPatterns.COMMIT.exec(text);
  if (commitMatch) {
    result.commit = commitMatch[1];
  }

  const tagMatch = GitHubPatterns.TAG.exec(text);
  if (tagMatch) {
    result.tag = tagMatch[1];
  }

  return result;
}
