import { startServer } from "session-server/client";

import { RecordingOption, requiresRecording } from "../options";

import { sessionCommand } from "./root"

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