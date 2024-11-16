import { guessFunctionName } from "./function-names";
import SourceParser from "./SourceParser";
import { pointToSourceLocation } from "./tree-sitter-locations";

/// <reference types="jest-extended" />

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
});

describe("extract function and their names", () => {
  const testCases = [
    {
      input: "function f1() { MARKER; }",
      expected: "f1",
    },
    {
      input: "var f2 = () => { MARKER; }",
      expected: "f2",
    },
    {
      input: "var f3 = function() { MARKER; }",
      expected: "f3",
    },
    {
      input: "f3b = function() { MARKER; }",
      expected: "f3b",
    },
    {
      input: "var o = { f4() { MARKER; } }",
      expected: "o.f4",
    },
    {
      input: "var o2 = { f4b: () => { MARKER; } }",
      expected: "o2.f4b",
    },
    {
      input: "o3.p.q = transform({ f4c: () => { MARKER; } })",
      expected: "o3.p.q.f4c",
    },
    {
      input: "class A { f5() { MARKER; } }",
      expected: "A.f5",
    },
    {
      input: "class A { f5b = () => { MARKER; } }",
      expected: "A.f5b",
    },
    {
      input: "class B { #f5b() { MARKER; } }",
      expected: "B.#f5b",
    },
    {
      input: "class C { constructor() { this.f5c = () => { MARKER; }; } }",
      expected: "C.f5c",
    },
    // {
    //   input: "const xyz = class D { myProp = function f5d() { MARKER; }; }",
    //   expected: "D.myProp.f5d",
    // },
    {
      input: "function *f7() { MARKER; yield x; }",
      expected: "f7",
    },
    {
      input: "async function *f8() { MARKER; yield await x; }",
      expected: "f8",
    },
  ];

  testCases.forEach(testCase => {
    test(`parses "${testCase.expected}"`, () => {
      const parser = new SourceParser("test.ts", testCase.input);
      parser.parse();

      const marker = parser.queryAllNodes(
        `((identifier) @constant (#match? @constant "MARKER"))`
      )[0];

      const func = parser.getInnermostFunction(pointToSourceLocation(marker.startPosition));
      expect(guessFunctionName(func!)).toBe(testCase.expected);
    });
  });
});

describe("input dependencies", () => {
  const code = `return /**BREAK*/ {
  declarations: rule.declarations.map((declaration) =>
    getDeclarationState(declaration, rule.domRule.objectId())
  ),
  id: rule.domRule.objectId(),
  inheritance: rule.inheritance,
  isUnmatched: rule.isUnmatched,
  isUserAgentStyle: rule.domRule.isSystem,
  pseudoElement: rule.pseudoElement,
  selector: rule.selector,
  sourceLink: rule.sourceLink,
  type: rule.domRule.type,
};
`;
  const parser = new SourceParser("test.ts", code);
  parser.parse();

  const node = parser.tree.rootNode;
  const dependencies = parser.getInterestingInputDependencies(node).map(n => n.text);
  expect(dependencies.toSorted()).toEqual([
    "rule",
    "rule.declarations",
    "rule.declarations.map",
    `rule.declarations.map((declaration) =>
    getDeclarationState(declaration, rule.domRule.objectId())
  )`,
    "rule.domRule.objectId()",
    "rule.domRule.objectId",
    "rule.domRule",
    "rule.inheritance",
    "rule.isUnmatched",
    "rule.domRule.isSystem",
    "rule.pseudoElement",
    "rule.selector",
    "rule.sourceLink",
    "rule.domRule.type",
  ].toSorted());
});
