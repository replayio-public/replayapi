import { ExecutionPoint } from "@replayio/protocol";

import ReplaySession from "./src/recording-data/ReplaySession";

/**
 * Debugging recordingId used only during early development.
 */
const RecordingId = "011f1663-6205-4484-b468-5ec471dc5a31";
const SymptomPoint: ExecutionPoint = "78858008544042601258383216576823298";

(async function main() {
  console.log("Starting Replay session...");
  const session = new ReplaySession();
  await session.initialize(RecordingId);

  console.log("Querying point...");
  const point = await session.queryPoint(SymptomPoint);

  const statement = await point.queryStatement();
  const stack = await point.queryRichStack();

  console.log("Statement at point:", statement);
  console.log("Stack at point:", stack);
})();
