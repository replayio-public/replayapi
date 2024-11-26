import assert from "assert";

import ReplaySession from "../src/recording-data/ReplaySession";

let sessionPromise: Promise<ReplaySession> | null = null;
export async function getReplaySessionForTest(recordingId: string): Promise<ReplaySession> {
  if (!sessionPromise) {
    const session = new ReplaySession();
    await (sessionPromise = session.initialize(recordingId).then(() => session));
    return session;
  } else {
    const session = await sessionPromise;
    
    // NOTE: We cannot currently have multiple sessions for different recordings in the same process, since
    // the client, as well as all cached data are globals.
    assert(
      session.getRecordingId() === recordingId,
      "Cannot create multiple sessions for different recordings."
    );
    return session;
  }
}
