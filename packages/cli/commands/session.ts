import { program } from "commander";
import { listServers, pruneServers, startServer } from "session-server/client";

import { RecordingOption, SessionOption, requiresRecording, requiresSession } from "./options";

const sessionCommand = program
  .command("session")
  .description("Manage persistent sessions with replay api");

// starts a new session
const startSessionCommand = sessionCommand
  .command("start")
  .description("start a persistent session.  Outputs the session id")
  .action(startSession);
requiresRecording(startSessionCommand);

type StartSessionOptions = RecordingOption;

async function startSession(opts: StartSessionOptions) {
  console.log(`Starting session for recording '${opts.recording}'...`);
  try {
    const serverInfoDeferred = startServer(opts.recording);
    const serverInfo = await serverInfoDeferred.promise;
    console.log(`Session ID: ${serverInfo.sessionId}`);
  } catch (e) {
    console.log(e);
  }
}

// ends a session and cleans up
const endSessionCommand = sessionCommand
  .command("end <SESSION_ID>")
  .description("ends a persistent session.")
  .action(endSession);
requiresSession(endSessionCommand);

type EndSessionOptions = SessionOption;

async function endSession(opts: EndSessionOptions) {
  console.log(`Ending session '${opts.session}'...`);
}

// lists sessions
sessionCommand.command("list").description("lists sessions").action(listSessions);

async function listSessions() {
  console.log("Listing sessions...");
  const servers = await listServers(true);
  console.table(servers, ["sessionId", "recordingId", "pid", "port", "alive"]);
}

// prunes zombie sessions
sessionCommand
  .command("prune")
  .description("removes all sessions that don't have a running server")
  .action(pruneSessions);

async function pruneSessions() {
  console.log("Pruning sessions...");
  await pruneServers();
}
