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

    expect(binding).toBeTruthy(); // or not.toBeNull()
    expect(binding).toMatchObject({
      kind: "const",
      location: {
        line: 3,
        code: expect.stringContaining("const y = 10;"),
        // It's top-level, so no functionName here
      },
    });
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

    expect(binding).toBeTruthy();
    expect(binding).toMatchObject({
      kind: "param", // or "var", depending on the parser
      location: {
        line: 2,
        code: expect.stringContaining("function add(a, b)"),
        functionName: "add",
      },
    });
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

    expect(binding).toBeTruthy();
    expect(binding).toMatchObject({
      kind: "const",
      location: {
        line: 4,
        code: expect.stringContaining("const z = 123;"),
        functionName: "inner",
      },
    });
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

  test("resolves nested declarations (shadowing variables)", () => {
    const code = `
      function shadowTest() {
        let x = "outer";
        {
          let x = "inner";
          console.log(x);
        }
        return x;
      }
    `;

    const parser = new SourceParser("test.ts", code);
    parser.parse();

    const locInner = { line: 6, column: 22 };
    expect(parser.getInnermostStatement(locInner)?.text).toBe("console.log(x);");

    const bindingInner = parser.getBindingAt(locInner, "x");
    expect(bindingInner).toBeTruthy();
    expect(bindingInner).toMatchObject({
      kind: "let",
      location: {
        line: 5,
        code: expect.stringContaining(`let x = "inner"`),
        // If your parser tracks functionName for block scopes, you might omit it or set it accordingly
      },
    });

    // The reference to "x" in `return x;` is on line 7
    const locOuter = { line: 8, column: 16 };
    const bindingOuter = parser.getBindingAt(locOuter, "x");
    expect(bindingOuter).toBeTruthy();
    expect(bindingOuter).toMatchObject({
      kind: "let",
      location: {
        line: 3,
        code: expect.stringContaining(`let x = "outer"`),
      },
    });
  });

  test("resolves destructuring parameter binding", () => {
    const code = `
      function destructure({ a, b }, [c]) {
        return a + b + c;
      }
      destructure({ a: 10, b: 20 }, [30]);
    `;

    const parser = new SourceParser("test.ts", code);
    parser.parse();

    // The reference to `b` is on line 3: `return a + b + c;`
    const loc = { line: 3, column: 19 };
    expect(parser.getInnermostExpression(loc)?.text).toBe("b");
    const binding = parser.getBindingAt(loc, "b");

    expect(binding).toBeTruthy();
    expect(binding).toMatchObject({
      kind: "param",
      location: {
        line: 2,
        code: expect.stringContaining("{ a, b }"),
        functionName: "destructure",
      },
    });
  });

  test("resolves destructuring assignment", () => {
    const code = `
      const [{ x }, y] = [{ x: 10 }, 20];
      console.log(x, y);

      const { foo, bar } = { foo: 1, bar: 2 };
      console.log(foo, bar);
    `;

    const parser = new SourceParser("test.ts", code);
    parser.parse();

    // The reference to `y` is on line 3: `console.log(x, y);`
    let loc = { line: 3, column: 21 }; // near "y"
    let binding = parser.getBindingAt(loc, "y");
    expect(binding).toBeTruthy();
    expect(binding).toMatchObject({
      kind: "const",
      location: {
        line: 2,
        code: "const [{ x }, y] = [{ x: 10 }, 20];",
      },
    });

    // The reference to `foo` is on line 6: `console.log(foo, bar);`
    loc = { line: 6, column: 20 };
    binding = parser.getBindingAt(loc, "foo");
    expect(binding).toBeTruthy();
    expect(binding).toMatchObject({
      kind: "const",
      location: {
        line: 5,
        code: expect.stringContaining("{ foo, bar } ="),
      },
    });
  });

  test("resolves an imported binding", () => {
    const code = `
      import { greet } from "./greet";
      console.log(greet("World"));

      export const someValue = 123;
      function testExport() {
        return someValue;
      }
    `;

    const parser = new SourceParser("test.ts", code);
    parser.parse();

    // The reference to `greet` is on line 3: `console.log(greet("World"));`
    let loc = { line: 3, column: 20 };
    let binding = parser.getBindingAt(loc, "greet");
    expect(binding).toBeTruthy();
    expect(binding).toMatchObject({
      kind: "module",
      location: {
        line: 2,
        code: expect.stringContaining("import { greet } from"),
      },
    });

    // The reference to `someValue` is on line 7: `return someValue;`
    loc = { line: 7, column: 16 };
    binding = parser.getBindingAt(loc, "someValue");
    expect(binding).toBeTruthy();
    // Typically an exported const is still "const"
    expect(binding).toMatchObject({
      kind: "const",
      location: {
        line: 5,
        code: "const someValue = 123;",
      },
    });
  });
});
