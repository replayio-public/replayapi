/* Copyright 2020-2024 Record Replay Inc. */

import "tsconfig-paths/register";

import "./commands/fetch-comments";
import "./commands/session";
//import "./commands/sources";
import "./commands/version";
import "./commands/tools";

import path from "path";

import { program } from "commander";
import createDebug from "debug";

// commands auto-register themselves when imported
import { printCommandError } from "./commandsShared/commandOutput";

const debug = createDebug("replay:main");

// Help stuff.
program
  .configureHelp({
    sortOptions: true,
    sortSubcommands: true,
  })
  .helpCommand("help [command]", "Display help for command")
  .helpOption("-h, --help", "Display help for command");

// Custom error handler.
function handleError(err: any) {
  const message = `Failed to execute command: ${err.message}`;
  const causedBy = err.cause ? `\n\n  [CAUSED BY] ${(err.cause as any).stack || err.cause}` : "";
  printCommandError(message, `${err.stack}${causedBy}`);
  process.exit(err.exitCode);
}
program
  .exitOverride(err => {
    if (err.exitCode && err.code !== "commander.help") {
      handleError(err);
    }
  })
  .on("error", err => {
    handleError(err);
  });

export async function main(): Promise<void> {
  try {
    debug(
      `"${path.relative(process.cwd(), __filename)}" ${process.argv.map(a => JSON.stringify(a)).join(",")}`
    );
    await program.parseAsync();
  } catch (err: any) {
    handleError(err);
  }
}

if (require.main === module) {
  main();
}
