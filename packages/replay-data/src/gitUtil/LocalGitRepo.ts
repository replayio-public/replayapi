/* Copyright 2020-2024 Record Replay Inc. */

import * as fs from "fs";
import * as path from "path";

import { SpawnAsyncResult, spawnAsync } from "@replay/data/src/util/spawnAsync";
import { extractRepoFolderName } from "./gitStringUtil";

export default class LocalGitRepo {
  /**
   * Local path to the git repo.
   */
  public readonly folderPath: string;

  constructor(
    workspaceFolder: string,
    isWorkspaceRepoPath: boolean,
    public url?: string,
    public treeish?: string
  ) {
    if (isWorkspaceRepoPath) {
      this.folderPath = workspaceFolder;
    } else if (url) {
      const folderName = extractRepoFolderName(url);
      if (!folderName) {
        throw new Error(`Could not extract repo folder name from git URL: ${url}`);
      }
      this.folderPath = path.resolve(workspaceFolder, folderName);
    } else {
      throw new Error(
        `Invalid arguments: If isWorkspaceRepoPath is false, a URL must be provided to determine the target path. - [${workspaceFolder}, ${isWorkspaceRepoPath}, ${url}]`
      );
    }
  }

  private async git(args: string[]): Promise<SpawnAsyncResult> {
    return await spawnAsync("git", args, {
      cwd: this.folderPath,
    });
  }

  async init(): Promise<void> {
    await this.clone();
    if (this.treeish) {
      await this.checkoutBranch(this.treeish);
    }
  }

  async clone(): Promise<void> {
    if (fs.existsSync(this.folderPath)) {
      if (!fs.existsSync(path.join(this.folderPath, ".git"))) {
        throw new Error(`Folder exists but is not a git repo: ${this.folderPath}`);
      }
      await this.git(["remote", "update"]);
    } else {
      if (!this.url) {
        throw new Error(`Cannot clone a repo without a URL: ${this.url}`);
      }
      await this.git(["clone", this.url, this.folderPath]);
    }
  }

  async checkoutBranch(branchOrCommit: string): Promise<void> {
    // Fetch + checkout the target branch or commit.
    await this.git(["fetch", "--all"]);
    await this.git(["checkout", branchOrCommit]);
  }

  async hardReset(): Promise<void> {
    // First reset any staged changes
    await this.git(["reset", "--hard"]);
    // Clean any untracked files/directories
    await this.git(["clean", "-fd"]);
  }
}

