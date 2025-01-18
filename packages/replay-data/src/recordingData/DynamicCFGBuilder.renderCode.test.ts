import { getReplaySessionForTest } from "../../testing/sessions";
import DynamicCFGBuilder from "./DynamicCFGBuilder";
import ReplaySession from "./ReplaySession";

const RecordingId = "43a890bc-6f37-47e0-ba47-4d04827e4e44";

describe("Render catch code", () => {
  let session: ReplaySession;
  beforeAll(async () => {
    session = await getReplaySessionForTest(RecordingId);
  });

  test("renderCode basics", async () => {
    // Break on `console.error('Error updating map:', error);`
    const breakPoint = "59386895319809399210736544775143457";

    const pq = await session.queryPoint(breakPoint);
    expect(await pq.getSourceLocation()).toEqual(
      expect.objectContaining({
        line: 111,
      })
    );

    const cfgBuilder = new DynamicCFGBuilder(pq);
    // const cfg = await cfgBuilder.buildProjectedFrameCFG();
    // const root = cfg.root;

    // Render
    const rendered = await cfgBuilder.renderCode({ windowHalfSize: 5 });

    expect(rendered.annotatedCode.split("\n")).toEqual([
      "          padding: [50, 50],",
      "          maxZoom: 16",
      "        });",
      "      }",
      "    } catch (error) {",
      "      /*POINT:59386895319809399210736544775143457*/console.error('Error updating map:', error);",
      "      // Reset to default view on error",
      "      /*POINT:59386895319809401516579553988837411*/map.setView([51.505, -0.09], 13);",
      "    }",
      "  }",
    ]);
  });

  test("renderCode with mismatching points", async () => {
    // Break on `console.error('Error updating map:', error);`
    const breakPoint = "59386895319809859226417290928986813";

    const pq = await session.queryPoint(breakPoint);
    expect(await pq.getSourceLocation()).toEqual(
      expect.objectContaining({
        line: 150,
      })
    );

    const cfgBuilder = new DynamicCFGBuilder(pq);
    // const cfg = await cfgBuilder.buildProjectedFrameCFG();
    // const root = cfg.root;

    // Render
    const rendered = await cfgBuilder.renderCode({ windowHalfSize: 1, annotateOtherPoints: false });

    expect(rendered.annotatedCode).toContain(breakPoint);
    expect(JSON.stringify(rendered.annotatedCode)).toEqual("\"\\t\\t    max2 = bounds.max,\\r\\n\\t\\t    xIntersects = (max2./*POINT:59386895319809859226417290928986813*/x >= min.x) && (min2.x <= max.x),\\r\\n\\t\\t    yIntersects = (max2.y >= min.y) && (min2.y <= max.y);\\r\"");
  });
});
