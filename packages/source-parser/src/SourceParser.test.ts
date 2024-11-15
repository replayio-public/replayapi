import SourceParser from "./SourceParser";
import { expect } from '@jest/globals';

describe('SourceParser', () => {
  test('basic statement extraction', () => {
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

  test('statement extraction2', () => {
    const code = "createCache({\n  config: { immutable: true },\n  debugLabel: \"AppliedRules\",\n  getKey: ([replayClient, pauseId, nodeId]) => `${pauseId}:${nodeId}`,\n  load: async ([replayClient, pauseId, nodeId]) => {\n    const { rules, data } = await replayClient.getAppliedRules(pauseId, nodeId);\n\n    const uniqueRules = uniqBy(rules, rule => `${rule.rule}|${rule.pseudoElement}`);\n\n    const sources = await sourcesByIdCache.readAsync(replayClient);\n    cachePauseData(replayClient, sources, pauseId, data);\n\n    const stylePromises: Promise<ProtocolObject>[] = [];\n\n    const rulePreviews = await Promise.all(\n      uniqueRules.map(async appliedRule => {\n        return objectCache.readAsync(replayClient, pauseId, appliedRule.rule, \"canOverflow\");\n      })\n    );\n\n    for (let ruleObject of rulePreviews) {\n      if (ruleObject.preview?.rule?.style) {\n        stylePromises.push(\n          objectCache.readAsync(\n            replayClient,\n            pauseId,\n            ruleObject.preview.rule.style,\n            \"canOverflow\"\n          ) as Promise<ProtocolObject>\n        );\n      }\n\n      if (ruleObject.preview?.rule?.parentStyleSheet) {\n        stylePromises.push(\n          objectCache.readAsync(\n            replayClient,\n            pauseId,\n            ruleObject.preview?.rule?.parentStyleSheet,\n            \"canOverflow\"\n          ) as Promise<ProtocolObject>\n        );\n      }\n    }\n\n    if (stylePromises.length) {\n      await Promise.all(stylePromises);\n    }\n\n    const wiredRules: WiredAppliedRule[] = uniqueRules.map((appliedRule, i) => {\n      return {\n        rule: new RuleFront(pauseId, rulePreviews[i]),\n        pseudoElement: appliedRule.pseudoElement,\n      };\n    });\n    return wiredRules;\n  },\n})";
    
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
