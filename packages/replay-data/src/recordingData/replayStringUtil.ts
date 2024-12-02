import { ExecutionPoint, RecordingId } from "@replayio/protocol";

import { getSourceCodeComments } from "./comments";

/**
 * Look for the first Replay URL, its `recordingId` and optional `point` in a given string.
 */
export function scanReplayUrl(text: string): {
  recordingId?: RecordingId;
  point?: string;
} {
  const match = /\.replay\.io\/recording\/([a-zA-Z0-9-]+)/.exec(text);
  if (match) {
    try {
      const url = new URL(
        "https://replay.io/recording/" + match[1] + text.slice(match.index + match[0].length)
      );
      const idMaybeWithTitle = match[1];
      const recordingId = /^.*?--([a-zA-Z0-9-]+)$/.exec(idMaybeWithTitle)?.[1] || idMaybeWithTitle;
      const point = url.searchParams.get("point") || undefined;

      return { recordingId, point };
    } catch (_e: any) {
      // Mute exception.
    }
  }
  return { recordingId: undefined, point: undefined };
}

/**
 * Look for a `recordingId` and `point` based on a Replay URL in a string.
 * If URL has no point, find point at first comment.
 */
export async function scanRecordingAndPoint(
  text: string
): Promise<{ recordingId?: string; point?: ExecutionPoint }> {
  // 1. Extract recordingId from issue.
  let { recordingId, point } = scanReplayUrl(text);
  if (!recordingId) {
    return {};
  }

  if (!point) {
    // 2. Get first source comment with a point.
    const comment = (await getSourceCodeComments(recordingId)).find(c => c.point);
    if (comment) {
      point = comment.point || undefined;
    }
  }
  return { recordingId, point };
}
