import "./commands/fetch-comments";
import "./commands/session";
//import "./commands/sources";
import "./commands/version";
import "./commands/annotate-execution-points";
import "./commands/tools";

import path from "path";

import { program } from "commander";
import createDebug from "debug";

// commands auto-register themselves when imported
import { printCommandError } from "./commandsShared/print";

const debug = createDebug("replay:_main_impl_");

program.configureHelp({
  sortOptions: true,
  sortSubcommands: true,
});
program.helpCommand("help [command]", "Display help for command");
program.helpOption("-h, --help", "Display help for command");

function handleError(err: any) {
  const message = `Failed to execute command: ${err.message}`;
  const causedBy = err.cause ? `\n\n  [CAUSED BY] ${(err.cause as any).stack || err.cause}` : "";
  printCommandError(message, `${err.stack}${causedBy}`);
  process.exit(err.exitCode);
}

// Add a custom error handler.
program.exitOverride(err => {
  if (err.exitCode && err.code !== "commander.help") {
    handleError(err);
  }
});

program.on("error", err => {
  handleError(err);
});

(async function main() {
  try {
    debug(`"${path.relative(process.cwd(), __filename)}" ${process.argv.map(a => JSON.stringify(a)).join(",")}`);
    await program.parseAsync();
  } catch (err: any) {
    handleError(err);
  }
})();
