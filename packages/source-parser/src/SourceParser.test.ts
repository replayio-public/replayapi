import { expect } from "@jest/globals";

import { guessFunctionName } from "./display-names";
import SourceParser from "./SourceParser";
import { pointToSourceLocation } from "./tree-sitter-locations";

describe("SourceParser", () => {
  test("basic statement extraction", () => {
    const code = `function foo() {
    return f(x, g("hello123qweSdfjnlsdfksjdnlsdgndf", 123));
  }`;
    const parser = new SourceParser("test.ts", code);
    parser.parse();

    // Test innermost statement
    const innermostStmt = parser.getInnermostStatement({ line: 2, column: 4 });
    expect(innermostStmt?.text).toBe('return f(x, g("hello123qweSdfjnlsdfksjdnlsdgndf", 123));');
    const annotatedTextAtReturn = parser.getAnnotatedNodeTextAt(
      { line: 2, column: 4 },
      "/*BREAK*/"
    );
    expect(annotatedTextAtReturn).toContain("/*BREAK*/return");

    // Test outermost expression
    const outermostExpr = parser.getOutermostExpression({ line: 2, column: 30 });
    expect(outermostExpr?.text).toBe('f(x, g("hello123qweSdfjnlsdfksjdnlsdgndf", 123))');

    const annotatedTextAtExpression = parser.getAnnotatedNodeTextAt(
      { line: 2, column: 30 },
      "/*BREAK*/"
    );
    expect(annotatedTextAtExpression).toContain("qwe/*BREAK*/Sdf");
  });

  test("statement extraction2", () => {
    const code =
      'createCache({\n  config: { immutable: true },\n  debugLabel: "AppliedRules",\n  getKey: ([replayClient, pauseId, nodeId]) => `${pauseId}:${nodeId}`,\n  load: async ([replayClient, pauseId, nodeId]) => {\n    const { rules, data } = await replayClient.getAppliedRules(pauseId, nodeId);\n\n    const uniqueRules = uniqBy(rules, rule => `${rule.rule}|${rule.pseudoElement}`);\n\n    const sources = await sourcesByIdCache.readAsync(replayClient);\n    cachePauseData(replayClient, sources, pauseId, data);\n\n    const stylePromises: Promise<ProtocolObject>[] = [];\n\n    const rulePreviews = await Promise.all(\n      uniqueRules.map(async appliedRule => {\n        return objectCache.readAsync(replayClient, pauseId, appliedRule.rule, "canOverflow");\n      })\n    );\n\n    for (let ruleObject of rulePreviews) {\n      if (ruleObject.preview?.rule?.style) {\n        stylePromises.push(\n          objectCache.readAsync(\n            replayClient,\n            pauseId,\n            ruleObject.preview.rule.style,\n            "canOverflow"\n          ) as Promise<ProtocolObject>\n        );\n      }\n\n      if (ruleObject.preview?.rule?.parentStyleSheet) {\n        stylePromises.push(\n          objectCache.readAsync(\n            replayClient,\n            pauseId,\n            ruleObject.preview?.rule?.parentStyleSheet,\n            "canOverflow"\n          ) as Promise<ProtocolObject>\n        );\n      }\n    }\n\n    if (stylePromises.length) {\n      await Promise.all(stylePromises);\n    }\n\n    const wiredRules: WiredAppliedRule[] = uniqueRules.map((appliedRule, i) => {\n      return {\n        rule: new RuleFront(pauseId, rulePreviews[i]),\n        pseudoElement: appliedRule.pseudoElement,\n      };\n    });\n    return wiredRules;\n  },\n})';

    const parser = new SourceParser("test.ts", code);
    parser.parse();

    const s = parser.getRelevantContainingNodeAt({ line: 55, column: 12 });
    expect(s?.text).toEqual("return wiredRules;");

    const annotatedTextAtExpression = parser.getAnnotatedNodeTextAt(
      { line: 55, column: 11 },
      "/*BREAK*/"
    );
    expect(annotatedTextAtExpression).toEqual("return /*BREAK*/wiredRules;");
  });

  test("extract function and their names", () => {
    const code = `
      function f1() { MARKER; }
      var f2 = () => { MARKER; }
      var f3 = function() { MARKER; }
      f3b = function() { MARKER; }
      var o = { f4() { MARKER; } }
      var o2 = { f4b: () => { MARKER; } }
      o3.p.q = transform({ f4c: () => { MARKER; } })
      class A { f5() { MARKER; } }
      class A { f5b = () => { MARKER; } }
      class B { #f5b() { MARKER; } }
      class C { constructor() { this.f5c = () => { MARKER; }; } }
      function *f7() { MARKER; yield x; }
      async function *f8() { MARKER; yield await x; }
    `;
    const nLines = code.trim().split("\n").length;
    const parser = new SourceParser("test.ts", code);
    parser.parse();

    const markers = parser.queryAllNodes(
      `((identifier) @constant (#match? @constant "MARKER"))`
    );
    expect(markers).toHaveLength(nLines);

    const allFunctions = markers.map(marker =>
      parser.getInnermostFunction(pointToSourceLocation(marker.startPosition))
    );
    expect(allFunctions).toHaveLength(nLines);

    const functionNames = allFunctions.map(f => (f ? guessFunctionName(f) : "(null)"));
    expect(functionNames).toEqual([
      "f1",
      "f2",
      "f3",
      "f3b",
      "o.f4",
      "o2.f4b",
      "o3.p.q.f4c",
      "A.f5",
      "A.f5b",
      "B.#f5b",
      "C.f5c",
      "f7",
      "f8",
    ]);
  });
});
