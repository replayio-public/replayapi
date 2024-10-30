import { pruneServers } from "session-server/client";

import { sessionCommand } from "./root";

sessionCommand
  .command("prune")
  .description("removes all sessions that don't have a running server")
  .action(pruneSessions);

async function pruneSessions() {
  console.log("Pruning sessions...");
  await pruneServers();
}
