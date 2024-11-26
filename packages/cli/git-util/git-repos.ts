import * as fs from "fs";
import * as path from "path";

import simpleGit, { SimpleGit } from "simple-git";

export class GitRepo {
  private git: SimpleGit;
  /**
   * Local path to the git repo.
   */
  public readonly folderPath: string;

  constructor(
    public url: string,
    workspaceFolder: string
  ) {
    // Extract folder from GitHub url using regex.
    // Implicitely asserts on proper GitHub url structure.
    const folderName = extractRepoName(url);
    if (!folderName) {
      throw new Error(`Invalid git URL did not have an explicit folder name: ${url}`);
    }
    this.folderPath = path.resolve(workspaceFolder, folderName);

    this.git = simpleGit(this.folderPath);
  }

  async init(branchOrCommit?: string): Promise<void> {
    await this.clone();
    if (branchOrCommit) {
      await this.checkoutBranch(branchOrCommit);
    }
  }

  async clone(): Promise<void> {
    if (fs.existsSync(this.folderPath)) {
      if (!fs.existsSync(path.join(this.folderPath, ".git"))) {
        throw new Error(`Folder exists but is not a git repo: ${this.folderPath}`);
      }
      // Already exists, just update
      const repoGit = simpleGit(this.folderPath);
      await repoGit.remote(["update"]);
    } else {
      await this.git.clone(this.url, this.folderPath);
    }
  }

  async checkoutBranch(branchOrCommit: string): Promise<void> {
    await this.git.fetch(["--all"]);
    await this.git.checkout(branchOrCommit);
  }
}

// Function to extract repository name from GitHub URL
function extractRepoName(url: string): string | null {
  // Handle different GitHub URL formats
  const patterns = [
    // Standard GitHub URLs
    /github\.com\/[^/]+\/([^/\n\s#?]+)/,
    // Git URLs
    /git@github\.com:[^/]+\/([^/\n\s#?.]+)(?:\.git)?/,
    // HTTPS clone URLs
    /https:\/\/github\.com\/[^/]+\/([^/\n\s#?.]+)(?:\.git)?/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}
