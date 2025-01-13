/* Copyright 2020-2024 Record Replay Inc. */

import fs from "fs";
import path from "path";

import {
  HardcodedDir,
  importHardcodedData,
  isDefaultHardcodedValueStub,
  sanitizeHardcodedPath,
} from "@replayio/data/src/recordingData/hardcodedCore";

const DryRun = !process.argv.includes("--go");

async function walk(dir: string): Promise<void> {
  const files = fs.readdirSync(dir);

  // Process all files in parallel using Promise.all
  await Promise.all(
    files.map(async file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        await walk(filePath);
      } else if (stat.isFile()) {
        const rawContent = fs.readFileSync(filePath, "utf8").toString();
        if (filePath !== sanitizeHardcodedPath(filePath)) {
          console.log(
            `DEL unsanitized path: ${filePath} (content = ${rawContent})`
          );
          if (!DryRun) {
            fs.unlinkSync(filePath);
          }
        } else {
          const content = await importHardcodedData(filePath);
          if (!content || isDefaultHardcodedValueStub(content)) {
            console.log(
              `DEL stub file ${filePath} (content = ${rawContent})`
            );
            if (!DryRun) {
              fs.unlinkSync(filePath);
            }
          }
        }
      }
    })
  );
}

(async function main() {
  try {
    await walk(HardcodedDir);
    if (DryRun) {
      console.log(`\n\n\nThis was a dry run. Run with --go ("tsx ${__filename} --go") to delete files.`);
    } else {
      console.log("\n\n\nCleanup completed successfully.");
    }
  } catch (error: any) {
    console.error("Error during cleanup:", error.stack);
    process.exit(1);
  }
})();
