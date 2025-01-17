import { NodePath } from "@babel/traverse";
import truncate from "lodash/truncate";

import { getReplaySessionForTest } from "../../testing/sessions";
import DynamicCFGBuilder, { CFGBlock } from "./DynamicCFGBuilder";
import ReplaySession from "./ReplaySession";
import { FrameStep } from "./types";

const RecordingId = "011f1663-6205-4484-b468-5ec471dc5a31";

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

describe("PointQueries basics", () => {
  let session: ReplaySession;
  beforeAll(async () => {
    session = await getReplaySessionForTest(RecordingId);
  });
  test("CFG for populate start", async () => {
    const break3Point = "67175340610898351232456180199587842";
    const pq = await session.queryPoint(break3Point);

    expect(await pq.getSourceLocation()).toEqual(
      expect.objectContaining({
        line: 67,
      })
    );

    const cfgBuilder = new DynamicCFGBuilder(pq);
    const cfg = await cfgBuilder.buildProjectedFrameCFG();
    const root = cfg.root;

    // Only one iteration of the function.
    expect(root.iterations!.length).toEqual(1);

    const functionNode = root.iterations![0];
    const blocks = functionNode.steps.filter(s => "parent" in s);

    // 5 blocks directly inside the function.
    expect(mapBlocks(blocks)).toHaveLength(5);
  });

  test("CFG for populate part 3", async () => {
    // Break on `this._maybeAddRule(rule, elemNodeWithId);`
    const break3Point = "69122451933109336961380259098263602";
    const pq = await session.queryPoint(break3Point);

    expect(await pq.getSourceLocation()).toEqual(
      expect.objectContaining({
        line: 156,
      })
    );

    // while (parentNodeId) {
    //       if (elem.nodeType == Node.ELEMENT_NODE) {
    //         for (const { rule, pseudoElement } of parentApplied) {
    //           if (!pseudoElement) {

    const cfgBuilder = new DynamicCFGBuilder(pq);
    const cfg = await cfgBuilder.buildProjectedFrameCFG();
    const root = cfg.root;

    // Only one iteration of the function.
    expect(root.iterations!.length).toEqual(1);

    const functionNode = root.iterations![0];
    const topLevelBlocks = functionNode.steps.filter(s => "parent" in s);
    expect(mapBlocks(topLevelBlocks)).toHaveLength(5);

    const whileBlock = topLevelBlocks[4];
    expect(whileBlock.staticBlock.type).toEqual("WhileStatement");
    expect(whileBlock.iterations).toHaveLength(10);

    const firstWhileIteration = whileBlock.iterations![0];
    const blocksInWhile = firstWhileIteration.steps.filter(s => "parent" in s);
    expect(mapBlocks(blocksInWhile)).toHaveLength(2);

    const nestedIf1 = blocksInWhile[1];
    expect(nestedIf1.staticBlock.type).toEqual("IfStatement");
    expect(nestedIf1.iterations).toHaveLength(1);

    const nestedIf1Iteration = nestedIf1.iterations![0];
    const forOf = nestedIf1Iteration.steps.find(
      s => "parent" in s && s.staticBlock.type === "ForOfStatement"
    )! as CFGBlock;
    expect(forOf.iterations).toHaveLength(3);

    const forOfIteration = forOf.iterations![1];
    const nestedIf2 = forOfIteration.steps.find(s => "parent" in s)! as CFGBlock;
    expect(nestedIf2.staticBlock.type).toEqual("IfStatement");
    expect((nestedIf2.iterations![0].steps as FrameStep[]).map(s => s.point)).toContain(
      break3Point
    );

    // Test render
    const rendered = await cfgBuilder.render(5);

    expect(rendered.annotatedCode.split("\n")).toEqual([
      "          return;",
      "        }",
      "",
      "        for (const { rule, pseudoElement/*POINT:69122451933109336961380259098263600*/ } of parentApplied) {",
      "          /*POINT:69122451933109336961380259098263601*/if (!pseudoElement) {",
      "            /*POINT:69122451933109336961380259098263602*/this._maybeAddRule(rule, elemNodeWithId);",
      "          }",
      "        }",
      "      }",
      "",
      "      /*POINT:69122451933109430348022132252868660*/parentNodeId = elem.parentNode;",
    ]);
  });
});
