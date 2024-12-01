import * as fs from "fs";
import * as path from "path";

import { SpawnAsyncResult, spawnAsync } from "@replay/data/src/util/spawnAsync";

export class GitRepo {
  /**
   * Local path to the git repo.
   */
  public readonly folderPath: string;

  constructor(
    public url: string,
    workspaceFolder: string
  ) {
    const folderName = extractRepoFolderName(url);
    if (!folderName) {
      throw new Error(`Could not extract repo folder name from git URL: ${url}`);
    }
    this.folderPath = path.resolve(workspaceFolder, folderName);
  }

  private async git(args: string[]): Promise<SpawnAsyncResult> {
    return await spawnAsync("git", args, {
      cwd: this.folderPath,
    });
  }

  async init(branchOrCommit?: string): Promise<void> {
    await this.clone();
    if (branchOrCommit) {
      await this.checkoutBranch(branchOrCommit);
    }
    await this.hardReset();
  }

  async clone(): Promise<void> {
    if (fs.existsSync(this.folderPath)) {
      if (!fs.existsSync(path.join(this.folderPath, ".git"))) {
        throw new Error(`Folder exists but is not a git repo: ${this.folderPath}`);
      }
      await this.git(["remote", "update"]);
    } else {
      await this.git(["clone", this.url, this.folderPath]);
    }
  }

  async checkoutBranch(branchOrCommit: string): Promise<void> {
    // Fetch + checkout the target branch or commit.
    await this.git(["fetch", "--all"]);
    await this.git(["checkout", branchOrCommit]);
  }

  async hardReset(): Promise<void> {
    // TODO: We should not hard-reset without user consent; but without it we run the risk of getting stuck.

    // First reset any staged changes
    await this.git(["reset", "--hard"]);
    // Clean any untracked files/directories
    await this.git(["clean", "-fd"]);
  }
}

function extractRepoFolderName(url: string): string | null {
  const patterns = [
    /github\.com\/[^/]+\/([^/\n\s#?]+)/,
    /git@github\.com:[^/]+\/([^/\n\s#?.]+)(?:\.git)?/,
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
