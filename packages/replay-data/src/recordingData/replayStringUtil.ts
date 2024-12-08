import { ExecutionPoint, RecordingId } from "@replayio/protocol";

/**
 * Look for the first Replay URL, its `recordingId` and optional `point` in a given string.
 */
export function scanReplayUrl(text: string): {
  recordingId?: RecordingId;
  point?: string;
} {
  const match = /\.replay\.io\/recording\/([a-zA-Z0-9-]+)(?:[^\s:\])]*)/.exec(text);
  let recordingId: RecordingId | undefined;
  let point: ExecutionPoint | undefined;
  if (match) {
    const idMaybeWithTitle = match[1];
    recordingId = /^.*?--([a-zA-Z0-9-]+)$/.exec(idMaybeWithTitle)?.[1] || idMaybeWithTitle;

    try {
      const url = new URL(
        "https://" + match[0]
      );
      point = url.searchParams.get("point") || undefined;
    } catch (_e: any) {
      // Mute exception.
    }
  }
  return { recordingId, point };
}

