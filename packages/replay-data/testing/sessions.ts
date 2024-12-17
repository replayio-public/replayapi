import ReplaySession, { getOrCreateReplaySession } from "../src/recordingData/ReplaySession";

export async function getReplaySessionForTest(recordingId: string): Promise<ReplaySession> {
  return getOrCreateReplaySession(recordingId);
}
