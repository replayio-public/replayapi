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
 * tsc has no structured output format option:
 * By default, it might spread errors over multiple lines.
 * At least, extra lines are indented!
 */
function collapseIndentedLines(lines: string[]): string[] {
  return lines.reduce<string[]>((acc, line) => {
    if (line.startsWith(" ")) {
      acc[acc.length - 1] += ` -- ${line.trim()}`;
    } else {
      acc.push(line.trim());
    }
    return acc;
  }, []);
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

  // Merge multiline errors.
  const errorLines = collapseIndentedLines(lines);

  // Filter out any lines with .yalc.
  const filtered = filterUninterestingFiles(errorLines);

  // Print output to stderr
  if (filtered.length > 0) {
    console.error(filtered.join("\n"));
    process.exit(1); // Non-zero exit if errors
  } else {
    process.exit(0); // Zero exit if no errors
  }
}

main();
