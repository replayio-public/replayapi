import { RecordingId } from "@replayio/protocol";

export function scanRecordingId(issue: string): RecordingId | null {
  const match = /https:\/\/app.replay\.io\/recording\/([a-zA-Z0-9-]+)/.exec(issue);
  if (!match) {
    return null;
  }
  const titleAndId = match[1];
  const match2 = /^.*?--([a-zA-Z0-9-]+)$/.exec(titleAndId);
  if (match2) {
    return match2[1];
  }
  return titleAndId;
}
