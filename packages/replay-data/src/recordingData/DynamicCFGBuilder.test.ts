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

function getPopulateSample() {
  return `class A {
    async f() {
      this.rules = [];
  
      const nodeObject = await objectCache.readAsync(
        this.replayClient,
        this.pauseId,
        this.nodeId,
        "canOverflow"
      );
      const node = nodeObject?.preview?.node;
  
      if (!node) {
        return;
      }
  
      const wiredRules = await appliedRulesCache.readAsync(
        this.replayClient,
        this.pauseId,
        this.nodeId
      );
  
      // Show rules applied to pseudo-elements first.
      for (const { rule, pseudoElement } of wiredRules) {
        if (pseudoElement) {
          this._maybeAddRule(rule, undefined, pseudoElement);
        }
      }
  
      // The inline rule has higher priority than applied rules.
      if (node.style) {
        const inlineStyleObject = await objectCache.readAsync(
          this.replayClient,
          this.pauseId,
          node.style,
          "canOverflow"
        );
        const styleFront = new StyleFront(inlineStyleObject);
        this._maybeAddRule(styleFront);
      }
  
      // Show rules applied directly to the element in priority order.
      for (const { rule, pseudoElement } of wiredRules) {
        if (!pseudoElement) {
          this._maybeAddRule(rule);
        }
      }
  
      let parentNodeId = node.parentNode;
  
      // Show relevant rules applied to parent elements.
      while (parentNodeId) {
        const parentObject = await objectCache.readAsync(
          this.replayClient,
          this.pauseId,
          parentNodeId,
          "canOverflow"
        );
        const parentNode = parentObject.preview?.node;
        if (!parentNode) {
          break;
        }
        const parentNodeWithId = { nodeId: parentNodeId, node: parentNode };
  
        if (parentNode.nodeType == Node.ELEMENT_NODE) {
          if (parentNode.style) {
            const styleObject = await objectCache.readAsync(
              this.replayClient,
              this.pauseId,
              parentNode.style!,
              "canOverflow"
            );
            const parentInline = new StyleFront/*BREAK2*/(styleObject);
            if (parentInline.properties.length > 0) {
              this._maybeAddRule(parentInline, parentNodeWithId);
            }
          }
  
          const parentApplied = await appliedRulesCache.readAsync(
            this.replayClient,
            this.pauseId,
            parentNodeId
          );
  
          if (parentApplied === null) {
            this.rules = null;
            return;
          }
  
          for (const { rule, pseudoElement } of parentApplied) {
            if (!pseudoElement) {
              this._maybeAddRule/*BREAK3*/(rule, parentNodeWithId);
            }
          }
        }
  
        if (parentObject.preview?.node?.nodeName === "HTML") {
          break;
        }
  
        parentNodeId = parentNode.parentNode;
      }
  
      // Store a list of all pseudo-element types found in the matching rules.
      this.pseudoElements = this.rules.filter(r => r.pseudoElement).map(r => r.pseudoElement);
  
      // Mark overridden computed styles.
      this.onRuleUpdated();
    }
  }`;
}
