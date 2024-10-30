import { program } from "commander";

export const sessionCommand = program
  .command("session")
  .description("Manage persistent sessions with replay api");