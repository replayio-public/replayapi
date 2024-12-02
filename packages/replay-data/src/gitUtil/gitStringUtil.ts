/* Copyright 2020-2024 Record Replay Inc. */
export const GitHubPatterns = {
  REPO_PATTERNS: [
    /github\.com\/[^/]+\/([^/\n\s#?.]+)(?:\.git)?/,
    /git@github\.com:[^/]+\/([^/\n\s#?.]+)(?:\.git)?/,
    /https:\/\/github\.com\/[^/]+\/([^/\n\s#?.]+)(?:\.git)?/,
  ],
  REPO_URL:
    /(https:\/\/github\.com\/[^/\s]+\/[^/\s#?]+|git@github\.com:[^/\s]+\/[^/\s#?]+(?:\.git)?)/,
  BRANCH: /(?:tree|branch|blob)\/([^#?]+)/,
  COMMIT: /(?:tree|branch|blob|commit)\/([0-9a-f]{7,40})/,
  TAG: /tags\/([^/\s#?]+)/,
};

export function extractRepoFolderName(url: string): string | null {
  for (const pattern of GitHubPatterns.REPO_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
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
    result.repoUrl = repoMatch[1];
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
