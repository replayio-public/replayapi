import { listServers } from "session-server/client";

import { sessionCommand } from "./root";

sessionCommand.command("list").description("lists sessions").action(listSessions);

async function listSessions() {
  console.log("Listing sessions...");
  const servers = await listServers(true);
  console.table(servers, ["sessionId", "recordingId", "pid", "port", "alive"]);
}
