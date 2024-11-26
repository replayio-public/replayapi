import { inspect } from "util";

import SourceParser from "../SourceParser";
import StaticScope from "./StaticScope";

// Utility function to get bindings from a source string.
const getSampleRootScope = async (source: string): Promise<StaticScope> => {
  const parser = new SourceParser("test.tsx", source);
  parser.parse();

  expect(inspect(parser.scopes.errors.map(n => n.text))).toEqual(inspect([]));
  return parser.scopes.rootScope;
};

// Helper function to check if a name exists in declarations
const hasDeclaration = (scope: StaticScope, name: string, type: string) => {
  const decl = scope.getDescendantDeclaration(name);
  if (!decl) {
    throw new Error(`No declaration found: \`${name}\``);
  }
  const expected = `${name}: ${type}`;
  const actual = `${name}: ${decl.declarationNode?.type}`;
  expect(expected).toEqual(actual);
};

describe("Named Declarations Tests", () => {
  describe("Function Declarations", () => {
    it("basic functions", async () => {
      const source = `
                function basicFunction(x: number): number { return x; }
                function* generatorFunction() { yield 42; }
            `;
      const scope = await getSampleRootScope(source);
      hasDeclaration(scope, "x", "formal_parameters");
      hasDeclaration(scope, "basicFunction", "function_declaration");
      hasDeclaration(scope, "generatorFunction", "generator_function_declaration");
    });

    it("should handle function overloads", async () => {
      const source = `
                function overloadedFunction(x: string): string;
                function overloadedFunction(x: number): number;
                function overloadedFunction(x: any): any { return x; }

                function overloadedWithDifferentParams(): void;
                function overloadedWithDifferentParams(a: string): void;
                function overloadedWithDifferentParams(a: string, b: number): void;
                function overloadedWithDifferentParams(a?: string, b?: number) {}
            `;
      const scope = await getSampleRootScope(source);
      hasDeclaration(scope, "overloadedFunction", "function_declaration");
      hasDeclaration(scope, "overloadedWithDifferentParams", "function_declaration");
    });

    it("function expressions", async () => {
      const source = `
                const arrowFunction = (x: number) => x * 2;
                const functionExpression = function(x: number) { return x * 2; };
                const generatorExpression = function* () { yield 123; };
            `;
      const scope = await getSampleRootScope(source);
      hasDeclaration(scope, "arrowFunction", "variable_declarator");
      hasDeclaration(scope, "functionExpression", "variable_declarator");
      hasDeclaration(scope, "generatorExpression", "variable_declarator");
    });
  });

  describe("Class Declarations", () => {
    it("class declarations", async () => {
      const source = `
                class BasicClass {}
                class DerivedClass extends BasicClass {}
                class CtorDeclarations {
                    constructor(
                        private x: number,
                        protected readonly y: string,
                        public z = 42,
                        private readonly w?: boolean
                    ) {}
                }
                @decorator
                class ClassWithDecorators {}
            `;
      const scope = await getSampleRootScope(source);
      hasDeclaration(scope, "BasicClass", "class_declaration");
      hasDeclaration(scope, "DerivedClass", "class_declaration");
      hasDeclaration(scope, "CtorDeclarations", "class_declaration");
      hasDeclaration(scope, "ClassWithDecorators", "class_declaration");
    });

    // it("class constructor parameter properties", async () => {
    //   const source = `
    //             class Test {
    //                 constructor(
    //                     private privateParam: string,
    //                     public publicParam: number,
    //                     protected protectedParam: boolean
    //                 ) {}
    //             }
    //         `;
    //   const declarations = await getSampleDeclarations(source);
    // });

    // it("class members", async () => {
    //   const source = `
    //             class Test {
    //                 regularMethod() { return 42; }
    //                 *generatorMethod() { yield 42; }
    //                 get accessorProperty() { return 42; }
    //                 set accessorProperty(value: number) {}
    //                 normalProperty = 42;
    //                 methodProperty = () => 42;
    //                 generatorProperty = function* () { yield 42; };
    //             }
    //         `;
    //   const declarations = await getSampleDeclarations(source);
    // });
  });

  describe("Interface Declarations", () => {
    it("interfaces", async () => {
      const source = `
                interface BasicInterface {}
                interface ExtendedInterface extends BasicInterface {}
                interface MergedDeclaration { x: number; }
                interface MergedDeclaration { y: string; }
            `;
      const scope = await getSampleRootScope(source);
      hasDeclaration(scope, "BasicInterface", "interface_declaration");
      hasDeclaration(scope, "ExtendedInterface", "interface_declaration");
      hasDeclaration(scope, "MergedDeclaration", "interface_declaration");
    });

    //     it("interface members", async () => {
    //       const source = `
    //                 interface Test {
    //                     regularProperty: string;
    //                     methodSignature(): void;
    //                     computedProperty?: string;
    //                     additionalProperty: number;
    //                 }
    //             `;
    //       const declarations = await getSampleRootDeclarations(source);
    //     });
  });

  describe("Type Aliases", () => {
    it("type aliases", async () => {
      const source = `
                type SimpleType = string;
                type ComplexType<T> = { field: T; method(): void; };
                type TypeWithProperties = {
                    normalProperty: string;
                    methodProperty(): number;
                    computedProperty?: string;
                };
            `;
      const scope = await getSampleRootScope(source);
      hasDeclaration(scope, "SimpleType", "type_alias_declaration");
      hasDeclaration(scope, "ComplexType", "type_alias_declaration");
      hasDeclaration(scope, "TypeWithProperties", "type_alias_declaration");
    });
  });

  describe("Enum Declarations", () => {
    it("enums and their members", async () => {
      const source = `
                enum NumericEnum {
                    A,
                    B = 2
                }
                enum StringEnum {
                    X = "x",
                    Y = "y"
                }
            `;
      const scope = await getSampleRootScope(source);
      hasDeclaration(scope, "NumericEnum", "enum_declaration");
      hasDeclaration(scope, "StringEnum", "enum_declaration");
    });
  });

  describe("Module Declarations", () => {
    it("namespaces and modules", async () => {
      const source = `
                namespace OuterNamespace {
                    export const x = 1;
                    namespace InnerNamespace {
                        export const y = 2;
                    }
                }
                module ModuleExample {
                    export interface SomeInterface {}
                    export class SomeClass {}
                }
            `;
      const scope = await getSampleRootScope(source);
      hasDeclaration(scope, "OuterNamespace", "internal_module");
      hasDeclaration(scope, "InnerNamespace", "internal_module");
      hasDeclaration(scope, "ModuleExample", "module");
    });

    it("namespace members", async () => {
      const source = `
                namespace Test {
                    export const x = 1;
                    export const y = 2;
                    export interface SomeInterface {}
                    export class SomeClass {}
                }
            `;
      const scope = await getSampleRootScope(source);
      hasDeclaration(scope, "x", "variable_declarator");
      hasDeclaration(scope, "y", "variable_declarator");
      hasDeclaration(scope, "SomeInterface", "interface_declaration");
      hasDeclaration(scope, "SomeClass", "class_declaration");
    });
  });

  describe("Variable Declarations", () => {
    it("simple variables", async () => {
      const source = `
                let simpleVariable = 42;
                export const exportedVar = 42;
            `;
      const scope = await getSampleRootScope(source);
      hasDeclaration(scope, "simpleVariable", "variable_declarator");
      hasDeclaration(scope, "exportedVar", "variable_declarator");
    });

    it("destructured variables", async () => {
      const scope = await getSampleRootScope(`
                const { destructuredObject: renamedVar, normalVar } = { destructuredObject: 1, normalVar: 2 };
                const [arrayDestructured, ...restArray] = [1, 2, 3];
            `);
      hasDeclaration(scope, "renamedVar", "variable_declarator");
      hasDeclaration(scope, "normalVar", "variable_declarator");
      hasDeclaration(scope, "arrayDestructured", "variable_declarator");
      hasDeclaration(scope, "restArray", "variable_declarator");
    });

    it("more variables", async () => {
      const scope = await getSampleRootScope(`
                const { a, b: bb } = ab, c = o["c"];
                const { a, b: bb, c: { d: dd } } = ab, c = o["c"];
            `);
      hasDeclaration(scope, "a", "variable_declarator");
      hasDeclaration(scope, "bb", "variable_declarator");
      hasDeclaration(scope, "c", "variable_declarator");
      hasDeclaration(scope, "dd", "variable_declarator");
    });
  });

  describe("Import/Export Declarations", () => {
    it("imports", async () => {
      const source = `
                import { Something } from "somewhere";
                import DefaultImport from "somewhere";
                import * as Namespace from "somewhere";
                import { OriginalName as AliasedName } from "somewhere";
            `;
      const scope = await getSampleRootScope(source);
      hasDeclaration(scope, "Something", "import_clause");
      hasDeclaration(scope, "DefaultImport", "import_clause");
      hasDeclaration(scope, "Namespace", "import_clause");
      hasDeclaration(scope, "AliasedName", "import_clause");
    });

    it("tsx", async () => {
      const source = `
                function f() {
                  const a = [1, { b: 2 }];
                  return <div x="123" y={a}>divChild</div>;
                }
            `;
      const scope = await getSampleRootScope(source);
      hasDeclaration(scope, "a", "variable_declarator");
      hasDeclaration(scope, "f", "function_declaration");

      // `div` should not have a declaration.
      const divDecl = scope.getDescendantDeclaration("div");
      expect(divDecl && inspect(divDecl.declarationNode)).toBeUndefined();
    });
  });

  //   describe("Object Properties", () => {
  //     it("computed properties", async () => {
  //       const source = `
  //                 const propertyKey = "dynamicKey";
  //                 const objectWithComputed = {
  //                     [propertyKey]: "value",
  //                     ["literal" + "Key"]: "value2"
  //                 };
  //             `;
  //       const declarations = await getSampleDeclarations(source);
  //     });

  //     it("object literal properties", async () => {
  //       const source = `
  //                 const objectLiteral = {
  //                     normalProperty: 1,
  //                     methodProperty() { return 2; },
  //                     *generatorProperty() { yield 3; },
  //                     get accessorProp() { return 4; },
  //                     set accessorProp(value: number) {}
  //                 };
  //             `;
  //       const declarations = await getSampleDeclarations(source);

  //     });
  //   });
});
