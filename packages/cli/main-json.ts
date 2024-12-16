/* Copyright 2020-2024 Record Replay Inc. */

/**
 * @file This file works like `main`, but takes a JSON input from file.
 */

import "tsconfig-paths/register";

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path, { join } from "path";

import { spawnAsync } from "@replayio/data/src/util/spawnAsync";
import { deterministicObjectHash } from "@replayio/data/src/util/objectUtil";

const DATA_ROOT_DIR = "/tmp/cli-specs";
const thisDir = __dirname;

(async function main() {
  // Read and parse input file
  try {
    const inputPath = join(thisDir, "input.json");
    const inputData = readFileSync(inputPath, "utf8");
    const input = JSON.parse(inputData);

    if (!input.tool) {
      console.error("Tool missing in spec");
      process.exit(1);
    }
    const recordingId = "011f1663-6205-4484-b468-5ec471dc5a31";
    input.params["recordingId"] = recordingId;

    const outputName = deterministicObjectHash(input);
    const outputPath = `${DATA_ROOT_DIR}/result/${recordingId}/${outputName}.json`;
    mkdirSync(path.dirname(outputPath), { recursive: true });
    const params = Object.entries(input.params).flatMap(([key, value]) => [`--${key}`, value]);
    const result = await spawnAsync(
      "tsx",
      ["-r", "tsconfig-paths/register", path.join(thisDir, "main.ts"), input.tool, ...params],
      {
        stdio: "inherit",
      }
    );
    writeFileSync(outputPath, result.stdout);
    console.log(`Done. Result: ${outputPath}`);
  } catch (error: any) {
    console.error(`Error reading or parsing input file: ${error?.stack || error}`);
    process.exit(1);
  }
})();
