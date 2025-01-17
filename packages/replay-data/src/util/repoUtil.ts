import { execSync } from "child_process";
import { statSync } from "fs";
import { join } from "path";

import maxBy from "lodash/maxBy";

interface FileWithDate {
  file: string;
  date: Date;
}

function getGitRoot(cwd: string): string {
  return execSync("git rev-parse --show-toplevel", { cwd }).toString().trim();
}

function getFileStats(filePath: string, gitRoot: string): FileWithDate {
  const fullPath = join(gitRoot, filePath);
  const stats = statSync(fullPath);
  return {
    file: filePath,
    date: stats.mtime,
  };
}

export function getRepoFiles(cwd = __dirname): string[] {
  const gitRoot = getGitRoot(cwd);

  // Get tracked files from HEAD
  const trackedFiles = execSync("git ls-tree -r HEAD --name-only", { cwd: gitRoot })
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean);

  // Get modified and untracked files
  const statusFiles = execSync("git status --porcelain", { cwd: gitRoot })
    .toString()
    .split("\n")
    .filter(Boolean)
    .map(line => line.trim().split(" ", 2)[1]);

  return [...new Set([...trackedFiles, ...statusFiles])];
}

export function getRepoFilesWithDates(cwd = __dirname): FileWithDate[] {
  const gitRoot = getGitRoot(cwd);
  const files = getRepoFiles(gitRoot);

  if (files.length === 0) {
    throw new Error("No files found in repository");
  }

  return files.map(file => getFileStats(file, gitRoot));
}

export function getRepoLatestModificationDate(cwd = __dirname): Date {
  const filesWithDates = getRepoFilesWithDates(cwd);
  return maxBy(filesWithDates, f => f.date.getTime())!.date;
}

if (require.main === module) {
  console.log(getRepoFilesWithDates());
}
