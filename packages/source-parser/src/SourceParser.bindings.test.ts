import SourceParser from "./SourceParser";

describe("getBindingAt", () => {
  test("returns null if there's no binding at the specified location", () => {
    const code = `
      const x = 42;
      function foo() {
        return x;
      }
      // No references here
    `;

    const parser = new SourceParser("test.ts", code);
    parser.parse();

    // Pick a location that doesn't reference any identifier
    const loc = { line: 6, column: 4 }; // On the comment line
    const binding = parser.getBindingAt(loc, "doesNotExist");
    expect(binding).toBeNull();
  });

  test("resolves a top-level variable binding", () => {
    const code = `
      // line 1
      const y = 10;
      console.log(y);
    `;

    const parser = new SourceParser("test.ts", code);
    parser.parse();

    // We expect the reference to "y" on line 3 to map back to line 2
    const loc = { line: 3, column: 14 }; // Inside "console.log(y);"
    const binding = parser.getBindingAt(loc, "y");
    expect(binding).not.toBeNull();
    expect(binding!.kind).toBe("const");

    // We expect that the binding is declared on line 2, code is `const y = 10;`
    expect(binding!.location.line).toBe(3);
    expect(binding!.location.code).toMatch("const y = 10;");
    // It's top-level, so we don't have a function name here
    expect(binding!.location.functionName).toBeUndefined();
  });

  test("resolves a function parameter binding", () => {
    const code = `
      function add(a, b) {
        return a + b;
      }
      const sum = add(2, 3);
    `;

    const parser = new SourceParser("test.ts", code);
    parser.parse();

    // The reference to `b` is on line 3, in `return a + b;`
    const loc = { line: 3, column: 18 };
    const binding = parser.getBindingAt(loc, "b");
    expect(binding).not.toBeNull();
    expect(binding!.kind).toBe("param"); // typically "param", or "var" if Babel doesn't differentiate

    // We expect the parameter to appear on line 2, code: `function add(a, b) {`
    expect(binding!.location.line).toBe(2);
    expect(binding!.location.code).toContain("function add(a, b)");
    expect(binding!.location.functionName).toBe("add");
  });

  test("resolves a variable in nested function scope", () => {
    const code = `
      function outer() {
        function inner() {
          const z = 123;
          return z;
        }
        return inner();
      }
    `;

    const parser = new SourceParser("test.ts", code);
    parser.parse();

    // The reference to `z` is on line 5: `return z;`
    const loc = { line: 5, column: 16 };
    const binding = parser.getBindingAt(loc, "z");
    expect(binding).not.toBeNull();
    expect(binding!.kind).toBe("const");

    // The declaration is on line 4: `const z = 123;`
    expect(binding!.location.line).toBe(4);
    expect(binding!.location.code).toContain("const z = 123;");

    // The functionName should be "inner"
    expect(binding!.location.functionName).toBe("inner");
  });

  test("returns null for undeclared variable references", () => {
    const code = `
      function foo() {
        return someUndefinedVar;
      }
    `;

    const parser = new SourceParser("test.ts", code);
    parser.parse();

    // Attempt to resolve `someUndefinedVar`, which doesn't exist
    const loc = { line: 3, column: 16 };
    const binding = parser.getBindingAt(loc, "someUndefinedVar");
    expect(binding).toBeNull();
  });
});
