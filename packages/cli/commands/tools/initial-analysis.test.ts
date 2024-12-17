import { getReplaySessionForTest } from "@replayio/data/testing/sessions";

import { CommandOutputSuccess, getCommandResult } from "../../commandsShared/commandOutput";
import { initialAnalysisAction } from "./initial-analysis";

const RecordingId = "011f1663-6205-4484-b468-5ec471dc5a31";

const InputPrompt = `https://app.replay.io/recording/${RecordingId}`;

describe("initialAnalysisAction integration", () => {
  it("should analyze an existing recording and return results", async () => {
    await initialAnalysisAction({ prompt: InputPrompt });

    const result = getCommandResult() as CommandOutputSuccess;

    expect(result).toEqual({
      status: "Success",
      result: expect.objectContaining({
        userComment: expect.stringMatching(/^The /),
        reactComponentName: "InheritanceRenderer",
        stackAndEvents: expect.any(Array),
      }),
    });

    // Get the actual session to verify the connection worked
    const session = await getReplaySessionForTest(RecordingId);
    expect(session).toBeDefined();

    // Clean up
    session.disconnect();
  });
});
