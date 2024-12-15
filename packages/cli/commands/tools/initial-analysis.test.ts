import { initialAnalysisAction } from "./initial-analysis";
import { getReplaySessionForTest } from "@replayio/data/testing/sessions";

describe("initialAnalysisAction integration", () => {
  const testRecordingId = "011f1663-6205-4484-b468-5ec471dc5a31";

  it("should analyze an existing recording and return results", async () => {
    const result = await initialAnalysisAction({
      recordingId: testRecordingId,
    });

    expect(result).toEqual({
      status: "Success",
      thisPoint: "78858008544042601258383216576823298",
      commentText: expect.stringMatching(/^The /),
      reactComponentName: "InheritanceRenderer",
      stackAndEvents: expect.any(Array),
    });

    // Get the actual session to verify the connection worked
    const session = await getReplaySessionForTest(testRecordingId);
    expect(session).toBeDefined();

    // Clean up
    session.disconnect();
  });
});
