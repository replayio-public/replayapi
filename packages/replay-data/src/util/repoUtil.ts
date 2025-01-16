import { execSync } from "child_process";
import path from "path";

import { maxBy } from "lodash";

// import sortBy from "lodash/sortBy";

export const ThisRepoRoot = path.resolve(__dirname, "..", "..", "..");

/**
 * Find the last modified file tracked by git and return its modification date.
 */
export function getRepoLatestModificationDate(cwd = __dirname): Date {
  // Use git ls-files to get tracked files, then stat to get modification time
  // console.log(
  //   "at",
  //   execSync("pwd", {
  //     cwd,
  //   }).toString()
  // );
  const output = execSync('git ls-files | xargs stat --format="%Y %N"', {
    cwd,
  }).toString();

  let files = output
    .trim()
    .split("\n")
    .map(line => {
      const [timestamp, file] = line.split(" ");
      return {
        file,
        date: new Date(parseInt(timestamp) * 1000),
      };
    });

  // files = sortBy(files, f => -f.date.getTime());
  return maxBy(files, f => f.date.getTime())!.date;
}
