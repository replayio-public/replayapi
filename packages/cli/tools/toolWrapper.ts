/* Copyright 2020-2024 Record Replay Inc. */

import { readFileSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { CommandOutputResult } from "../commandsShared/commandOutput";

export interface InputSpec {
  command: string;
  args: Record<string, any>;
}

export function readInputFile(inputPath: string): InputSpec {
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

export async function writeOutput(outputPath: string, result: CommandOutputResult | null): Promise<void> {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`Done. Result: ${outputPath}`);
}
