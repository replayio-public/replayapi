import SourceParser from "../SourceParser";
import { BindingMap } from "./StaticBindings";

// Utility function to get bindings from a source string
const getSampleDeclarations = async (source: string): Promise<BindingMap> => {
  const parser = new SourceParser("test.ts", source);
  parser.parse();
  return parser.bindings.computeNamedDeclarations(parser.tree.rootNode);
};

// Helper function to check if a name exists in declarations
const hasDeclaration = (declarations: BindingMap, name: string, type: string) => {
  const decl = declarations.get(name);
  if (!decl) {
    throw new Error(`No declaration found: \`${name}\``);
  }
  expect(decl.declarationNode?.type).toEqual(type);
};

describe("Named Declarations Tests", () => {
  describe("Function Declarations", () => {
    it("basic functions", async () => {
      const source = `
                function basicFunction(x: number): number { return x; }
                function* generatorFunction() { yield 42; }
            `;
      const declarations = await getSampleDeclarations(source);
      hasDeclaration(declarations, "basicFunction", "function_declaration");
      hasDeclaration(declarations, "generatorFunction", "generator_function_declaration");
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
      const declarations = await getSampleDeclarations(source);
      hasDeclaration(declarations, "overloadedFunction", "function_declaration");
      hasDeclaration(declarations, "overloadedWithDifferentParams", "function_declaration");
    });

    it("function expressions", async () => {
      const source = `
                const arrowFunction = (x: number) => x * 2;
                const functionExpression = function(x: number) { return x * 2; };
                const generatorExpression = function* () { yield 123; };
            `;
      const declarations = await getSampleDeclarations(source);
      hasDeclaration(declarations, "arrowFunction", "variable_declarator");
      hasDeclaration(declarations, "functionExpression", "variable_declarator");
      hasDeclaration(declarations, "generatorExpression", "variable_declarator");
    });
  });

  describe("Class Declarations", () => {
    it("class declarations", async () => {
      const source = `
                class BasicClass {}
                class DerivedClass extends BasicClass {}
                class ParameterPropertyVariations {
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
      const declarations = await getSampleDeclarations(source);
      hasDeclaration(declarations, "BasicClass", "class_declaration");
      hasDeclaration(declarations, "DerivedClass", "class_declaration");
      hasDeclaration(declarations, "ParameterPropertyVariations", "class_declaration");
      hasDeclaration(declarations, "ClassWithDecorators", "class_declaration");
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
      const declarations = await getSampleDeclarations(source);
      hasDeclaration(declarations, "BasicInterface", "interface_declaration");
      hasDeclaration(declarations, "ExtendedInterface", "interface_declaration");
      hasDeclaration(declarations, "MergedDeclaration", "interface_declaration");
    });

    it("interface members", async () => {
      const source = `
                interface Test {
                    regularProperty: string;
                    methodSignature(): void;
                    computedProperty?: string;
                    additionalProperty: number;
                }
            `;
      const declarations = await getSampleDeclarations(source);
      hasDeclaration(declarations, "regularProperty", "property_signature");
      hasDeclaration(declarations, "methodSignature", "method_signature");
      hasDeclaration(declarations, "computedProperty", "property_signature");
      hasDeclaration(declarations, "additionalProperty", "property_signature");
    });
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
      const declarations = await getSampleDeclarations(source);
      hasDeclaration(declarations, "SimpleType", "type_alias_declaration");
      hasDeclaration(declarations, "ComplexType", "type_alias_declaration");
      hasDeclaration(declarations, "TypeWithProperties", "type_alias_declaration");
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
      const declarations = await getSampleDeclarations(source);
      hasDeclaration(declarations, "NumericEnum", "enum_declaration");
      hasDeclaration(declarations, "StringEnum", "enum_declaration");
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
      const declarations = await getSampleDeclarations(source);
      hasDeclaration(declarations, "OuterNamespace", "internal_module");
      hasDeclaration(declarations, "InnerNamespace", "internal_module");
      hasDeclaration(declarations, "ModuleExample", "module");
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
      const declarations = await getSampleDeclarations(source);
      hasDeclaration(declarations, "x", "variable_declarator");
      hasDeclaration(declarations, "y", "variable_declarator");
      hasDeclaration(declarations, "SomeInterface", "interface_declaration");
      hasDeclaration(declarations, "SomeClass", "class_declaration");
    });
  });

  describe("Variable Declarations", () => {
    it("simple variables", async () => {
      const source = `
                let simpleVariable = 42;
                export const exportedVar = 42;
            `;
      const declarations = await getSampleDeclarations(source);
      hasDeclaration(declarations, "simpleVariable", "variable_declarator");
      hasDeclaration(declarations, "exportedVar", "variable_declarator");
    });

    it("destructured variables", async () => {
      const declarations = await getSampleDeclarations(`
                const { destructuredObject: renamedVar, normalVar } = { destructuredObject: 1, normalVar: 2 };
                const [arrayDestructured, ...restArray] = [1, 2, 3];
            `);
      hasDeclaration(declarations, "renamedVar", "variable_declarator");
      hasDeclaration(declarations, "normalVar", "variable_declarator");
      hasDeclaration(declarations, "arrayDestructured", "variable_declarator");
      hasDeclaration(declarations, "restArray", "variable_declarator");
    });

    it("more variables", async () => {
      const declarations = await getSampleDeclarations(`
                const { a, b: bb } = ab, c = o["c"];
                const { a, b: bb, c: { d: dd } } = ab, c = o["c"];
            `);
      hasDeclaration(declarations, "a", "variable_declarator");
      hasDeclaration(declarations, "bb", "variable_declarator");
      hasDeclaration(declarations, "c", "variable_declarator");
      hasDeclaration(declarations, "dd", "variable_declarator");
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
      const declarations = await getSampleDeclarations(source);
      hasDeclaration(declarations, "Something", "import_specifier");
      hasDeclaration(declarations, "DefaultImport", "import_clause");
      hasDeclaration(declarations, "Namespace", "import_clause");
      hasDeclaration(declarations, "AliasedName", "import_clause");
    });

    it("exports", async () => {
      const source = `
                const simpleVariable = 42;
                class BasicClass {}
                export { simpleVariable, BasicClass };
                export default basicFunction;
                export const exportedVar = 42;
            `;
      const declarations = await getSampleDeclarations(source);
      hasDeclaration(declarations, "simpleVariable", "export_specifier");
      hasDeclaration(declarations, "BasicClass", "export_specifier");
      hasDeclaration(declarations, "exportedVar", "variable_declarator");
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
