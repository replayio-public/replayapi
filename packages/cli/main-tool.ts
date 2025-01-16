/* Copyright 2020-2024 Record Replay Inc. */

/**
 * @file Convenient wrapper for `main` to work better with AI agents. Operates on json files.
 */

import "tsconfig-paths/register";

import { Command } from "commander";
import createDebug from "debug";

import { CommandOutputResult, getCommandResult } from "./commandsShared/commandOutput";
import { parsePrompt } from "./parsePrompt";
import {
  cacheResponse,
  clearCache,
  isToolCacheEnabled,
  readCachedResponse,
} from "./tools/toolCache";
import { InputSpec, readInputFile, writeOutput } from "./tools/toolWrapper";

const debug = createDebug("replay:main-tool");

const program = new Command();

// Default command
program
  .command("run", { isDefault: true })
  .argument("<inputPath>", "Path to input JSON file")
  .argument("<outputPath>", "Path to output directory")
  .action(run);

// Clear cache command
program
  .command("clear-cache")
  .alias("c")
  .description("Clear the cache")
  .action(async () => {
    await clearCache();
  });

async function main() {
  // Parse and run.
  program.parse();
}

async function hashString(str: string, maxLen: number): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)).then(hash =>
    Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, ""))
      .join("")
      .slice(0, maxLen)
  );
}

async function makeCacheInput(input: InputSpec): Promise<InputSpec | undefined> {
  let recordingId: string | undefined = input.args.recordingId;
  let cacheInput = input;
  if (!recordingId && input.command === "initial-analysis" && input.args.prompt) {
    // Quick hackfix for initial-analysis, which has prompt instead of recordingId:
    recordingId = parsePrompt(input.args.prompt).recordingId;
    const promptHash = await hashString(input.args.prompt, 32);
    cacheInput = {
      ...input,
      args: {
        ...input.args,
        recordingId,
        // Replace prompt with hash.
        prompt: promptHash,
      },
    };
  }
  if (!recordingId) {
    return undefined;
  }
  return cacheInput;
}

async function run(inputPath: string, outputPath: string) {
  try {
    // Read and prepare input.
    const input = readInputFile(inputPath);
    if (!input.command || !(typeof input.args === "object")) {
      throw new Error(`Invalid input file format: ${JSON.stringify(input || null, null, 2)}`);
    }
    const flattenedArgStrings = Object.entries(input.args).flatMap(([key, value]) =>
      // Flatten the props into a single string array, w/ special handling for boolean flags.
      value === true ? [`--${key}`] : value === false ? [] : [`--${key}`, value + ""]
    );

    // Prepare.
    const { main } = await import("./main.ts");

    // Check cache.
    let cachedResult: CommandOutputResult | null = null;
    const cacheInput = await makeCacheInput(input);
    const useCache = isToolCacheEnabled() && !!cacheInput;
    if (useCache) {
      cachedResult = await readCachedResponse(cacheInput);
    }

    // Run command.
    let result: CommandOutputResult | null = cachedResult;
    if (!cachedResult) {
      debug(`Computing response...`);
      // 1. Hackfix-override `argv`.
      process.argv = [process.argv[0], process.argv[1], input.command, ...flattenedArgStrings];

      // 2. Run the actual command.
      await main();

      // 3. Get output.
      result = getCommandResult();
      if (!result) {
        throw new Error(
          `No result from command. Make sure that the command uses the commandOutput tools to print results. Input=${JSON.stringify(input)}`
        );
      }

      // 4. Cache output.
      if (useCache && !cachedResult) {
        await cacheResponse(cacheInput, result);
      }
    }

    // Write output.
    await writeOutput(outputPath, result);
  } catch (error: any) {
    console.error(error.stack);
    process.exit(1);
  }
}

main();
