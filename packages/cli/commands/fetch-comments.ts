import { getSourceCodeComments } from "@replayio/data/src/recordingData/comments";
import { program } from "commander";

import { printCommandResult } from "../commandsShared/commandOutput";
import { APIKeyOption, RecordingOption, requiresAPIKey, requiresRecording } from "./options";

const fetchCommand = program
  .command("fetch-comments")
  .description("Fetch source comments from a recording")
  .action(fetchRecordingComments);

requiresRecording(fetchCommand);
requiresAPIKey(fetchCommand);

type CommandOptions = RecordingOption & APIKeyOption;

async function fetchRecordingComments(opts: CommandOptions) {
  const { recordingId } = opts;
  const comments = await getSourceCodeComments(recordingId);
  printCommandResult(comments);
}
