import { removeNestedPaths } from "./babel/babelLocations";
import SourceParser from "./SourceParser";

/// <reference types="jest-extended" />

describe("BabelParser", () => {
  test("getAllBlockParentsInFunctionAt", () => {
    const code = `function root() {
    console.log("root");
    function foo1() {
      return 1;
    }

    if (true) {
      while (true) {
        console.log("hello");
      }
    }

    class A {
      foo2() {
        if (true) {
          while (true) {
            console.log("hello");
          }
        }
        return 2;
      }
    }
  }`;
    const parser = new SourceParser("test.ts", code);
    parser.parse();

    const babelParser = parser.babelParser!;
    const blocks = babelParser.getAllBlockParentsInFunctionAt({ line: 1, column: 35 });
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    const blockTexts = blocks.map(b => b.toString());
    expect(blockTexts).toHaveLength(3);
    expect(blocks[2].node).toEqual(
      expect.objectContaining({
        type: "WhileStatement",
      })
    );
  });

  test("getInnermostNodePathAt", () => {
    const code = `
    function foo1() {
      return 1;
    }

    class A {
      foo2() {
        return 2;
      }
    }
    `;
    const parser = new SourceParser("test.ts", code);
    parser.parse();

    const babelParser = parser.babelParser!;
    const foo1 = babelParser.getInnermostNodePathAt({ line: 3, column: 13 }, "Function");
    expect(foo1?.node).toEqual(
      expect.objectContaining({
        type: "FunctionDeclaration",
        id: expect.objectContaining({ name: "foo1" }),
      })
    );
    const foo2 = babelParser.getInnermostNodePathAt({ line: 8, column: 15 }, "Function");
    expect(foo2?.node).toEqual(
      expect.objectContaining({
        type: "ClassMethod",
        key: expect.objectContaining({ name: "foo2" }),
      })
    );
  });

  test("populate sample", () => {
    const code = getPopulateSample();
    const parser = new SourceParser("test.ts", code);
    parser.parse();

    const babelParser = parser.babelParser!;
    const blockPath = babelParser.getInnermostNodePathAt({ line: 3, column: 6 }, "Block")!;
    const functionNode = blockPath.parent;
    expect(functionNode.type).toEqual("ClassMethod");
    if (!("key" in functionNode)) {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      throw new Error("key not found in " + blockPath.toString());
    }
    expect((functionNode.key as any).name).toEqual("populate");

    // Only get top-level blocks within the function's own block.
    const blocksWithinFunctionBlock = babelParser.getAllBlockParentsWithinFunction(blockPath);
    const topLevelBlocks = removeNestedPaths(
      // Remove root function node, before removing nested.
      blocksWithinFunctionBlock.slice(1)
    );

    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    const blockTexts = topLevelBlocks.map(b => b.toString());
    expect(blockTexts).toHaveLength(5);
  });
});

function getPopulateSample() {
  return `class A {
    async populate() {
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
