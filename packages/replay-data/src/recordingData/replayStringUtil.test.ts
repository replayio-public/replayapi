import { scanReplayUrl } from "./replayStringUtil";

describe("scanReplayUrl", () => {
  test("extracts recording ID and point from valid URL", () => {
    const result = scanReplayUrl(
      "Check out https://app.replay.io/recording/localhost8080--011f1663-6205-4484-b468-5ec471dc5a31?point=78858008544042601258383216576823298"
    );
    expect(result).toEqual({
      recordingId: "011f1663-6205-4484-b468-5ec471dc5a31",
      point: "78858008544042601258383216576823298",
    });
  });

  test("handles URL without point parameter", () => {
    const result = scanReplayUrl("https://app.replay.io/recording/test--abc123");
    expect(result).toEqual({
      recordingId: "abc123",
      point: undefined,
    });
  });

  test("handles recording ID without title", () => {
    const result = scanReplayUrl("https://app.replay.io/recording/def456?point=789");
    expect(result).toEqual({
      recordingId: "def456",
      point: "789",
    });
  });

  test("returns undefined for non-replay URLs", () => {
    const result = scanReplayUrl("https://example.com/something");
    expect(result).toEqual({
      recordingId: undefined,
      point: undefined,
    });
  });

  test("handles multiple URLs in text", () => {
    const result = scanReplayUrl(
      "First URL: https://example.com, second URL: https://app.replay.io/recording/test--abc123?point=456"
    );
    expect(result).toEqual({
      recordingId: "abc123",
      point: "456",
    });
  });
});
