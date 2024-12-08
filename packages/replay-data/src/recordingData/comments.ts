import { ExecutionPoint, RecordingId } from "@replayio/protocol";
import type { SourceCodeCommentTypeData } from "replay-next/components/sources/utils/comments";
import { getComments } from "shared/graphql/Comments";
import { graphQLClient } from "shared/graphql/GraphQLClient";
import { CommentType } from "shared/graphql/types";

import { getApiKey } from "./ReplaySession";

export interface CommentLocation {
  sourceLineText: string | null;
  sourceUrl: string | null;
  line: number;
  column: number;
}

export interface RecordingComment {
  author?: string | null;
  text: string;
  point: ExecutionPoint;
  type?: CommentType;
  createdAt: string;
  location: CommentLocation | null;
}

export async function getSourceCodeComments(recordingId: RecordingId): Promise<RecordingComment[]> {
  const comments = await getComments(graphQLClient, recordingId, getApiKey());
  const rawComments = comments.filter(c => c.type === "source-code");
  return rawComments.map(c => {
    const content = JSON.parse(c.content);
    /**
     * NOTE: `content` is a SerializedEditorState object from the `lexical` package.
     */
    const root = content.root;
    const typeData = c.typeData as SourceCodeCommentTypeData | undefined;

    const commentData: RecordingComment = {
      author: c.user.name,
      // TODO: Fully reconstruct the comment text. Deal w/ markdown etc.
      text: root.children[0].children[0].text,
      point: c.point,
      type: c.type as CommentType,
      createdAt: c.createdAt,
      location: typeData
        ? {
            sourceLineText: typeData.plainText,
            sourceUrl: typeData.sourceUrl,
            line: typeData.lineNumber,
            column: typeData.columnIndex,
          }
        : null,
    };
    return commentData;
  });
}
