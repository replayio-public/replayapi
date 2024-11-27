import { ExecutionPoint } from "@replayio/protocol";

import { scanRecordingId } from "../git-util/github-issue";
import { getSourceCodeComments } from "./comments";

export async function fuzzyExtractRecordingAndPoint(
  text: string
): Promise<{ recordingId?: string; point?: ExecutionPoint }> {
  // 1. Extract recordingId from issue.
  const recordingId = scanRecordingId(text);
  if (!recordingId) {
    return {};
  }

  // 2. Get point from URL.
  // TODO

  // 3. Get first source comment with a point.
  //    NOTE: All source comments should have a point.
  const comment = (await getSourceCodeComments(recordingId)).find(c => c.point);
  if (!comment) {
    return { recordingId };
  }
  return { recordingId, point: comment.point };
}
