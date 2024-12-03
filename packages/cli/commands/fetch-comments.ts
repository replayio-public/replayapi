import { getSourceCodeComments } from "@replay/data/src/recordingData/comments";
import { program } from "commander";

import { printCommandResult } from "../commandsShared/print";
import { APIKeyOption, RecordingOption, requiresAPIKey, requiresRecording } from "./options";

const fetchCommand = program
  .command("fetch-comments")
  .description("Fetch source comments from a recording")
  .action(fetchRecordingComments);

requiresRecording(fetchCommand);
requiresAPIKey(fetchCommand);

type CommandOptions = RecordingOption & APIKeyOption;

async function fetchRecordingComments(opts: CommandOptions) {
  const { recording } = opts;
  const comments = await getSourceCodeComments(recording);
  printCommandResult(comments);
}
