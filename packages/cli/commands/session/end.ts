import { endServer } from "session-server/client";

import { SessionOption, requiresSession } from "../options";

import { sessionCommand } from "./root"

// ends a session and cleans up
const endSessionCommand = sessionCommand
  .command("end")
  .description("ends a persistent session.")
  .action(endSession);
requiresSession(endSessionCommand);

type EndSessionOptions = SessionOption;

async function endSession(opts: EndSessionOptions) {
  console.log(`Ending session '${opts.session}'...`);
  await endServer(opts.session);
}
