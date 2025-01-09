import { getReplaySessionForTest } from "../../testing/sessions";
import DynamicCFGBuilder from "./DynamicCFGBuilder";
import ReplaySession from "./ReplaySession";

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
    expect(blocks.length).toEqual(5);
  });

  test("CFG for populate part 3", async () => {
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
    expect(blocks.length).toEqual(5);
  });
});
