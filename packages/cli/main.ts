// commands auto-register themselves when imported
import "./commands/fetch-comments";
import "./commands/session";
import "./commands/sources";
import "./commands/version";

import { program } from "commander";

program.configureHelp({
  sortOptions: true,
  sortSubcommands: true,
});
program.helpCommand("help [command]", "Display help for command");
program.helpOption("-h, --help", "Display help for command");

program.parse();
