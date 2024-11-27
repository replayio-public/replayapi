import "./commands/fetch-comments";
import "./commands/session";
//import "./commands/sources";
import "./commands/version";

import { program } from "commander";

// commands auto-register themselves when imported
import { printCommandError } from "./commands-shared/print";

program.configureHelp({
  sortOptions: true,
  sortSubcommands: true,
});
program.helpCommand("help [command]", "Display help for command");
program.helpOption("-h, --help", "Display help for command");

// Add a custom error handler.
program.exitOverride(err => {
  if (err.exitCode && err.code !== "commander.help") {
    const message = `Failed to execute command: ${err.message}`;
    const causedBy = err.cause ? `\n\n  [CAUSED BY] ${(err.cause as any).stack || err.cause}` : "";
    printCommandError(message, `${err.stack}${causedBy}`);
    process.exit(err.exitCode);
  }
});

program.parse();
