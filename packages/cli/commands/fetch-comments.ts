import { program } from "commander";
import { getComments } from "shared/graphql/Comments";
import { graphQLClient } from "shared/graphql/GraphQLClient";

import { APIKeyOption, RecordingOption, requiresRecording } from "./options";

const fetchCommand = program
  .command("fetch-comments")
  .description("Fetch comments from a recording")
  .action(fetchRecordingComments);

requiresRecording(fetchCommand);

type CommandOptions = RecordingOption & APIKeyOption;

async function fetchRecordingComments(opts: CommandOptions) {
  const { recording, apiKey } = opts;
  const comments = await getComments(graphQLClient, recording, apiKey);
  console.log(
    comments
      .filter(c => c.type === "source-code")
      .map(c => {
        const content = JSON.parse(c.content);
        return {
          author: c.user.name,
          text: content.root.children[0].children[0].text,
          location: {
            sourceLineText: c.typeData.plainText,
            sourceUrl: c.typeData.sourceUrl,
            lineNumber: c.typeData.lineNumber,
            columnNumber: c.typeData.columnNumber,
          },
        };
      })
  );
}
