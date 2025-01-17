import { NodePath } from "@babel/traverse";
import truncate from "lodash/truncate";

import { getReplaySessionForTest } from "../../testing/sessions";
import DynamicCFGBuilder, { CFGBlock } from "./DynamicCFGBuilder";
import ReplaySession from "./ReplaySession";

const RecordingId = "43a890bc-6f37-47e0-ba47-4d04827e4e44";

function mapBlock(b: NodePath): { type: string; text: string } {
  return {
    type: b.type,
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    text: truncate(b.toString().replaceAll("\n", "\\n"), { length: 100 }),
  };
}

function mapBlocks(blocks: CFGBlock[]): { type: string; text: string }[] {
  return blocks.map(b => mapBlock(b.staticBlock));
}

describe("Render catch code", () => {
  let session: ReplaySession;
  beforeAll(async () => {
    session = await getReplaySessionForTest(RecordingId);
  });

  test("CFG for throwing useEffect cb", async () => {
    // Break on `console.error('Error updating map:', error);`
    const breakPoint = "59386895319809399210736544775143457";

    const pq = await session.queryPoint(breakPoint);
    expect(await pq.getSourceLocation()).toEqual(
      expect.objectContaining({
        line: 111,
      })
    );

    // while (parentNodeId) {
    //       if (elem.nodeType == Node.ELEMENT_NODE) {
    //         for (const { rule, pseudoElement } of parentApplied) {
    //           if (!pseudoElement) {

    const cfgBuilder = new DynamicCFGBuilder(pq);
    // const cfg = await cfgBuilder.buildProjectedFrameCFG();
    // const root = cfg.root;

    // Render
    const rendered = await cfgBuilder.render(5);

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
});
