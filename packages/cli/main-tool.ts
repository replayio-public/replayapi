/* Copyright 2020-2024 Record Replay Inc. */

import "tsconfig-paths/register";

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import { Command } from "commander";

import { CommandOutputResult, getCommandResult } from "./commandsShared/commandOutput";

/**
 * @file Convenient wrapper for `main` to work better with AI agents. Operates on json files.
 */

interface InputSpec {
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

async function writeOutput(outputPath: string, result: CommandOutputResult | null): Promise<void> {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`Done. Result: ${outputPath}`);
}

async function main() {
  // Set up wrapper command.
  const program = new Command();
  program.argument("<inputPath>", "Path to input JSON file.");
  program.argument("<outputPath>", "Path to output directory.");

  // Parse and run.
  program.parse();
  const [inputPath, outputPath] = program.args;

  try {
    // 0. Read and prepare input.
    const input = readInputFile(inputPath);
    if (!input.command || !(typeof input.args === "object")) {
      throw new Error(`Invalid input file format: ${JSON.stringify(input || null, null, 2)}`);
    }
    const flattenedArgStrings = Object.entries(input.args).flatMap(([key, value]) =>
      // Flatten the props into a single string array, w/ special handling for boolean flags.
      value === true ? [`--${key}`] : value === false ? [] : [`--${key}`, value + ""]
    );

    // 1. Hackfix-override `argv`.
    process.argv = [process.argv[0], process.argv[1], input.command, ...flattenedArgStrings];

    // 2. Run the actual command.
    const { main } = await import("./main.ts");
    await main();

    // 3. Write output.
    const result = getCommandResult();
    await writeOutput(outputPath, result);
  } catch (error: any) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
