import { getReplaySessionForTest } from "../../testing/sessions";
import DynamicCFGBuilder from "./DynamicCFGBuilder";
import ReplaySession from "./ReplaySession";

const RecordingId = "43a890bc-6f37-47e0-ba47-4d04827e4e44";

describe("CFG basics", () => {
  let session: ReplaySession;
  beforeAll(async () => {
    session = await getReplaySessionForTest(RecordingId);
  });
  test("1", async () => {
    const point = "59386895319739582896103881787310083";
    const pq = await session.queryPoint(point);

    expect(await pq.getSourceLocation()).toEqual(
      expect.objectContaining({
        line: 250,
      })
    );

    const cfgBuilder = new DynamicCFGBuilder(pq);
    const cfg = await cfgBuilder.buildProjectedFrameCFG();

    cfgBuilder.renderCode();
  });
});
