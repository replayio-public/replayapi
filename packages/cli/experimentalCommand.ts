/* Copyright 2020-2024 Record Replay Inc. */

/**
 * @file Convenience script to run any `experimentalCommand` API command.
 */

import "tsconfig-paths/register";

import { readFileSync } from "node:fs";

import { getOrCreateReplaySession } from "@replayio/data/src/recordingData/ReplaySession.ts";
import { assert } from "@replayio/data/src/util/assert";
import { RecordingId } from "@replayio/protocol";
import { Command } from "commander";
import { printCommandResult } from "./commandsShared/commandOutput";

interface InputSpec {
  recordingId: RecordingId;
  command: string;
  args: Record<string, any>;
}

function readInputFile(inputPath: string): InputSpec {
  let inputData: string | undefined;
  try {
    inputData = readFileSync(inputPath, "utf8");
    const input = JSON.parse(inputData);
    return input;
  } catch (error: any) {
    throw new Error(
      `Error reading or parsing input file from "${inputPath}" (contents=${inputData}): ${error?.stack || error}`
    );
  }
}

async function main() {
  // Set up wrapper command.
  const program = new Command();
  program.argument("<inputPath>", "Path to input JSON file.");
  // program.option("-c, --clear-cache", "Clear the cache", false)

  // Parse and run.
  program.parse();
  const [inputPath] = program.args;

  try {
    // 0. Read and prepare input.
    const input = readInputFile(inputPath);

    assert(input.command, "command missing. File must have format: { command, recordingId, args }");
    assert(input.recordingId, "recordingId missing. File must have format: { command, recordingId, args }");

    // 2. Run the actual command.
    const session = getOrCreateReplaySession(input.recordingId);
    const res = await (await session).experimentalCommand(input.command, input.args);
    printCommandResult(res);
  } catch (error: any) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
