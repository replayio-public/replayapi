import { GitHubParseResult, scanGitUrl } from "@replayio/data/src/gitUtil/gitStringUtil";
import {
  scanAnnotationDataUrl,
  scanReplayUrl,
} from "@replayio/data/src/recordingData/replayStringUtil";

export function parsePrompt(prompt: string): {
  recordingId: string | undefined;
  githubInfo: GitHubParseResult;
  annotationDataUrl: string | undefined;
} {
  const { recordingId } = scanReplayUrl(prompt);
  const githubInfo = scanGitUrl(prompt);
  const annotationDataUrl = scanAnnotationDataUrl(prompt);

  return {
    recordingId,
    githubInfo,
    annotationDataUrl,
  };
}
