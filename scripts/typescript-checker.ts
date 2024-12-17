#!/usr/bin/env tsx
/* Copyright 2020-2024 Record Replay Inc. */

import { spawnSync } from "child_process";

function runTsc(): string {
  const command = "tsc";
  const args = ["--noEmit", ...process.argv.slice(2)];
  console.log(`Running ${command} ${args.join(" ")}...`);
  const result = spawnSync(command, args, {
    stdio: "pipe",
    encoding: "utf-8",
  });
  return (result.stdout + "\n" + result.stderr).trim();
}

/**
 * tsc has no structured output format.
 */
function mergeMultilineErrors(lines: string[]): string[] {
  const merged: string[] = [];
  let currentLine: string | null = null;

  for (const line of lines) {
    if (line.startsWith("  ")) {
      // Continuation line: merge into previous line with ` -- `
      if (currentLine !== null) {
        currentLine += " -- " + line.trim();
      } else {
        // If we somehow get a continuation line without a current line, just treat it as new
        currentLine = line.trim();
      }
    } else {
      // New main line: push the previous one if it exists
      if (currentLine !== null) {
        merged.push(currentLine);
      }
      currentLine = line;
    }
  }

  // Push the last line if there is one
  if (currentLine !== null) {
    merged.push(currentLine);
  }

  return merged;
}

function filterUninterestingFiles(lines: string[]): string[] {
  return lines.filter(
    l =>
      // We don't have control over the .yalc folder.
      !l.includes(".yalc")
  );
}

function main() {
  const stderrOutput = runTsc();
  const lines = stderrOutput.split("\n").filter(l => l.trim() !== "");

  // Merge multiline errors
  const merged = mergeMultilineErrors(lines);

  // Filter out any lines with .yalc
  const filtered = filterUninterestingFiles(merged);

  // Print output to stderr
  if (filtered.length > 0) {
    console.error(filtered.join("\n"));
    process.exit(1); // Non-zero exit if errors
  } else {
    process.exit(0); // Zero exit if no errors
  }
}

main();
