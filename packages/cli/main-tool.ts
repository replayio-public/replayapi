/* Copyright 2020-2024 Record Replay Inc. */

import "tsconfig-paths/register";

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import { deterministicObjectHash } from "@replayio/data/src/util/objectUtil";
import { Command } from "commander";

import { CommandOutputResult, getCommandResult } from "./commandsShared/commandOutput";
/**
 * @file Convenient wrapper for `main` to work better with AI agents. Operates on json files.
 */

interface InputSpec {
  command: string;
  params: Record<string, string>;
}

function readInputFile(inputPath: string): InputSpec {
  try {
    const inputData = readFileSync(inputPath, "utf8");
    const input = JSON.parse(inputData);
    return input;
  } catch (error: any) {
    throw new Error(`Error reading or parsing input file from "${inputPath}": ${error?.stack || error}`);
  }
}

async function writeOutput(
  result: CommandOutputResult,
  input: InputSpec,
  outputDataFolder?: string
) {
  const recordingId = "011f1663-6205-4484-b468-5ec471dc5a31";
  if (!outputDataFolder) {
    outputDataFolder = `/tmp/cli-data/out`;
  }

  const outputName = deterministicObjectHash(input);
  const outputPath = path.resolve(outputDataFolder, `${recordingId}/${outputName}.json`);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`Done. Result: ${outputPath}`);
}

async function main() {
  // Set up wrapper command.
  const program = new Command();
  program.argument("<inputPath>", "Path to input JSON file.");

  // Parse and run.
  program.parse();
  const [inputPath] = program.args;
  const options = program.opts();

  try {
    // 0. Read and prepare input.
    const input = readInputFile(inputPath);
    if (!input.command || !(typeof input.params === "object")) {
      throw new Error(`Invalid input file format: ${JSON.stringify(input || null, null, 2)}`);
    }
    const recordingId = "011f1663-6205-4484-b468-5ec471dc5a31";
    input.params["recordingId"] ||= recordingId;
    const commandArgs = Object.entries(input.params).flatMap(([key, value]) => [`--${key}`, value]);

    // 1. Hackfix-override `argv`.
    process.argv = [process.argv[0], process.argv[1], input.command, ...commandArgs];

    // 2. Run the actual command.
    await import("./main.ts");

    // 3. Write output.
    const result = getCommandResult() || {};
    await writeOutput(result, input, options.output);
  } catch (error: any) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
