import { GitHubParseResult, scanGitUrl } from "@replayio/data/src/gitUtil/gitStringUtil";
import {
  scanAnnotationDataUrl,
  scanReplayUrl,
} from "@replayio/data/src/recordingData/replayStringUtil";
import { ExecutionPoint } from "@replayio/protocol";

export function parsePrompt(prompt: string): {
  recordingId: string | undefined;
  point?: ExecutionPoint;
  githubInfo: GitHubParseResult;
  annotationDataUrl: string | undefined;
} {
  const { recordingId, point } = scanReplayUrl(prompt);
  const githubInfo = scanGitUrl(prompt);
  const annotationDataUrl = scanAnnotationDataUrl(prompt);

  return {
    recordingId,
    point,
    githubInfo,
    annotationDataUrl,
  };
}
