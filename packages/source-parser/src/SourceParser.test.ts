import { Function, FunctionDeclaration, Identifier, Method } from "@babel/types";

import { guessFunctionName } from "./function-names";
import SourceParser from "./SourceParser";
import { treeSitterPointToSourceLocation } from "./tree-sitter-locations";

/// <reference types="jest-extended" />

describe("Node extraction", () => {
  test("1", () => {
    const code = `function foo() {
    return f(x, g("hello123qweSdfjnlsdfksjdnlsdgndf", 123));
  }`;
    const parser = new SourceParser("test.ts", code);
    parser.parse();

    // Test innermost statement
    const innermostStmt = parser.getInnermostStatement({ line: 2, column: 4 });
    expect(innermostStmt?.text).toBe('return f(x, g("hello123qweSdfjnlsdfksjdnlsdgndf", 123));');
    const [annotatedTextAtReturn] = parser.getAnnotatedNodeTextAt(
      { line: 2, column: 4 },
      "/*BREAK*/"
    )!;
    expect(annotatedTextAtReturn).toContain("/*BREAK*/return");

    // Test outermost expression
    const outermostExpr = parser.getOutermostExpression({ line: 2, column: 30 });
    expect(outermostExpr?.text).toBe('f(x, g("hello123qweSdfjnlsdfksjdnlsdgndf", 123))');

    const [annotatedTextAtExpression] = parser.getAnnotatedNodeTextAt(
      { line: 2, column: 30 },
      "/*BREAK*/"
    )!;
    expect(annotatedTextAtExpression).toContain("qwe/*BREAK*/Sdf");
  });

  test("2", () => {
    const code =
      'createCache({\n  config: { immutable: true },\n  debugLabel: "AppliedRules",\n  getKey: ([replayClient, pauseId, nodeId]) => `${pauseId}:${nodeId}`,\n  load: async ([replayClient, pauseId, nodeId]) => {\n    const { rules, data } = await replayClient.getAppliedRules(pauseId, nodeId);\n\n    const uniqueRules = uniqBy(rules, rule => `${rule.rule}|${rule.pseudoElement}`);\n\n    const sources = await sourcesByIdCache.readAsync(replayClient);\n    cachePauseData(replayClient, sources, pauseId, data);\n\n    const stylePromises: Promise<ProtocolObject>[] = [];\n\n    const rulePreviews = await Promise.all(\n      uniqueRules.map(async appliedRule => {\n        return objectCache.readAsync(replayClient, pauseId, appliedRule.rule, "canOverflow");\n      })\n    );\n\n    for (let ruleObject of rulePreviews) {\n      if (ruleObject.preview?.rule?.style) {\n        stylePromises.push(\n          objectCache.readAsync(\n            replayClient,\n            pauseId,\n            ruleObject.preview.rule.style,\n            "canOverflow"\n          ) as Promise<ProtocolObject>\n        );\n      }\n\n      if (ruleObject.preview?.rule?.parentStyleSheet) {\n        stylePromises.push(\n          objectCache.readAsync(\n            replayClient,\n            pauseId,\n            ruleObject.preview?.rule?.parentStyleSheet,\n            "canOverflow"\n          ) as Promise<ProtocolObject>\n        );\n      }\n    }\n\n    if (stylePromises.length) {\n      await Promise.all(stylePromises);\n    }\n\n    const wiredRules: WiredAppliedRule[] = uniqueRules.map((appliedRule, i) => {\n      return {\n        rule: new RuleFront(pauseId, rulePreviews[i]),\n        pseudoElement: appliedRule.pseudoElement,\n      };\n    });\n    return wiredRules;\n  },\n})';

    const parser = new SourceParser("test.ts", code);
    parser.parse();

    const s = parser.getRelevantContainingNodeAt({ line: 55, column: 12 });
    expect(s?.text).toEqual("return wiredRules;");

    const [annotatedTextAtExpression] = parser.getAnnotatedNodeTextAt(
      { line: 55, column: 11 },
      "/*BREAK*/"
    )!;
    expect(annotatedTextAtExpression).toEqual("return /*BREAK*/wiredRules;");
  });
});

describe("extract functions and their names", () => {
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

      const func = parser.getInnermostFunction(
        treeSitterPointToSourceLocation(marker.startPosition)
      );
      expect(guessFunctionName(func!)).toBe(testCase.expected);
    });
  });
});

describe("input dependencies", () => {
  test("1", () => {
    const code = `import { ReactElement, useMemo, useState } from "react";

import { RulesListData } from "devtools/client/inspector/markup/components/rules/RulesListData";
import { GenericList } from "replay-next/components/windowing/GenericList";
import { RuleState } from "ui/suspense/styleCaches";

import { ITEM_SIZE, RulesListItem, RulesListItemData } from "./RulesListItem";

export function RulesList({
  height,
  noContentFallback,
  rules,
  searchText,
}: {
  height: number;
  noContentFallback: ReactElement;
  rules: RuleState[];
  searchText: string;
}) {
  const [showPseudoElements, setShowPseudoElements] = useState(true);

  const rulesListData = useMemo(
    () => new RulesListData(rules, showPseudoElements),
    [rules, showPseudoElements]
  );

  const itemData = useMemo<RulesListItemData>(
    () => ({
      rules,
      searchText,
      setShowPseudoElements,
      showPseudoElements,
    }),
    [rules, showPseudoElements, searchText]
  );

  return (
    <GenericList
      dataTestId="RulesList"
      fallbackForEmptyList={noContentFallback}
      height={height}
      itemData={itemData}
      itemRendererComponent={RulesListItem}
      itemSize={ITEM_SIZE}
      listData={rulesListData}
      width="100%"
    />
  );
}
`;
    const location = { line: 38, column: 4 };

    const parser = new SourceParser("test.ts", code);
    parser.parse();

    const dependencies = parser.getInterestingInputDependencies(location).map(n => n.text);
    expect(dependencies.sort()).toEqual(
      [
        "noContentFallback",
        "height",
        "itemData",
        "RulesListItem",
        "ITEM_SIZE",
        "rulesListData",
        "GenericList",
      ].sort()
    );
  });

  test("2", () => {
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
    expect(dependencies.sort()).toEqual(
      [
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
      ].sort()
    );
  });

  test("BabelParser.getAllBlockParentsInFunctionAt", () => {
    const code = `function root() {
    console.log("root");
    function foo1() {
      return 1;
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
    expect(blockTexts).toHaveLength(5);
    expect(blocks[2].node).toEqual(
      expect.objectContaining({
        type: "ClassMethod",
        key: expect.objectContaining({ name: "foo2" }),
      })
    );
    expect(blocks[4].node).toEqual(
      expect.objectContaining({
        type: "WhileStatement"
      })
    );
  });

  test("BabelParser.getInnermostNodePathAt", () => {
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
});
