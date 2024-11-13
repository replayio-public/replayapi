import SourceParser from "./SourceParser";
import { expect } from '@jest/globals';

describe('SourceParser', () => {
  test('parses and analyzes code positions correctly', () => {
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
});