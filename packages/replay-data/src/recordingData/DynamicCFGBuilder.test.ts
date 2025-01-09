import truncate from "lodash/truncate";

import { getReplaySessionForTest } from "../../testing/sessions";
import DynamicCFGBuilder, { CFGBlock } from "./DynamicCFGBuilder";
import ReplaySession from "./ReplaySession";
import { FrameStep } from "./types";

const RecordingId = "011f1663-6205-4484-b468-5ec471dc5a31";

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
    const cfg = await cfgBuilder.computeProjectedFunctionCFG();

    // Only one iteration of the function.
    expect(cfg.iterations!.length).toEqual(1);

    const functionNode = cfg.iterations![0];
    const blocks = functionNode.steps.filter(s => "parent" in s);

    // 5 blocks directly inside the function.
    expect(
      blocks.map(b => ({
        type: b.staticBlock.type,
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        text: truncate(b.staticBlock.toString(), { length: 100 }),
      }))
    ).toHaveLength(5);
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
    const cfg = await cfgBuilder.computeProjectedFunctionCFG();

    // Only one iteration of the function.
    expect(cfg.iterations!.length).toEqual(1);

    const functionNode = cfg.iterations![0];
    const blocks = functionNode.steps.filter(s => "parent" in s);

    // 5 blocks directly inside the function.
    expect(
      blocks.map(b => ({
        type: b.staticBlock.type,
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        text: truncate(b.staticBlock.toString(), { length: 100 }),
      }))
    ).toHaveLength(5);

    const whileBlock = blocks[4];
    expect(whileBlock.staticBlock.type).toEqual("WhileStatement");
    expect(whileBlock.iterations).toHaveLength(10);

    const firstWhileIteration = whileBlock.iterations![0];
    const whileBlocks = firstWhileIteration.steps.filter(s => "parent" in s);
    expect(whileBlocks).toHaveLength(2);

    const nestedIf1 = whileBlocks[1];
    expect(nestedIf1.staticBlock.type).toEqual("IfStatement");
    expect(nestedIf1.iterations).toHaveLength(1);

    const nestedIf1Iteration = nestedIf1.iterations![0];
    const forOf1 = nestedIf1Iteration.steps.find(
      s => "parent" in s && s.staticBlock.type === "ForOfStatement"
    )! as CFGBlock;
    expect(forOf1.iterations).toHaveLength(1);

    const forOfIteration = forOf1.iterations![0];
    const nestedIf2 = forOfIteration.steps.find(s => "parent" in s)! as CFGBlock;
    expect(nestedIf2.staticBlock.type).toEqual("IfStatement");
    expect((nestedIf2.iterations![0].steps as FrameStep[]).map(s => s.point)).toContain(break3Point);
  });
});
