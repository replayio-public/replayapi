/* Copyright 2020-2024 Record Replay Inc. */
/**
 * @file Mostly generalized node type utilities.
 */

import difference from "lodash/difference";
import isString from "lodash/isString";
import union from "lodash/union";
import uniqBy from "lodash/uniqBy";
import Parser, { SyntaxNode } from "tree-sitter";
import TypeScript from "tree-sitter-typescript";

import { BaseNode, Language, NodeInfo } from "./tree-sitter-types";

/**
 * Node types, including concrete types and covers/abstract types.
 */
export type NodeTypeName = string;

/** ###########################################################################
 * {@link TypeCover}
 * ##########################################################################*/

// * Grammar definitions:
//    * https://github.com/tree-sitter/tree-sitter-javascript/blob/master/src/grammar.json
//    * https://github.com/tree-sitter/tree-sitter-typescript/blob/master/common/define-grammar.js#L3
//    * Node Types (this is available as Language.nodeTypeInfo)
//      * https://github.com/tree-sitter/tree-sitter-javascript/blob/master/src/node-types.json
//    * https://github.com/tree-sitter/tree-sitter-python/blob/master/grammar.js#L354
// * [Supertype Nodes](https://tree-sitter.github.io/tree-sitter/using-parsers#supertype-nodes)
//   * https://github.com/tree-sitter/tree-sitter-javascript/blob/master/src/grammar.json#L6924
//   * https://github.com/tree-sitter/tree-sitter-typescript/blob/master/common/define-grammar.js#L12
//   * https://github.com/tree-sitter/tree-sitter-python/blob/master/grammar.js#L60
export class TypeCover implements Iterable<NodeTypeName> {
  private types: Set<NodeTypeName>;

  constructor(
    public readonly language: LanguageInfo,
    types: Iterable<NodeTypeName | TypeCover>
  ) {
    const allTypes = new Set(
      Array.from(types).flatMap(t => (t instanceof TypeCover ? Array.from(t.types) : t))
    );

    // Type names can include abstract types, which, in turn also need to be looked up:
    const concreteTypes = this.language.getConcreteTypeNames(...allTypes);
    this.types = new Set(concreteTypes);
  }

  has(nodeOrType: NodeTypeName): boolean;
  has(nodeOrType: SyntaxNode): boolean;
  has(nodeOrType: NodeTypeName | SyntaxNode): boolean {
    return this.types.has(isString(nodeOrType) ? nodeOrType : nodeOrType.type);
  }

  [Symbol.iterator](): Iterator<NodeTypeName> {
    return this.types.values();
  }

  combine(...other: TypeCover[]): TypeCover {
    return new TypeCover(this.language, [...this, ...other.flat()]);
  }
}

/** ###########################################################################
 * {@link LanguageInfo}
 * ##########################################################################*/

function getLanguage(languageOrParser: Language | Parser): Language {
  return "nodeTypeInfo" in languageOrParser ? languageOrParser : languageOrParser.getLanguage();
}

export class LanguageInfo {
  readonly language: Language;
  readonly nodeInfos: NodeInfo[];
  readonly typesByNames: Map<NodeTypeName, BaseNode>;

  expression: TypeCover;
  statement: TypeCover;
  declaration: TypeCover;
  function: TypeCover;
  clazz: TypeCover;
  scopeOwner: TypeCover;
  jsx: TypeCover;
  constant: TypeCover;

  constructor(languageOrParser: Language | Parser) {
    this.language = getLanguage(languageOrParser);
    this.nodeInfos = this.language.nodeTypeInfo;
    if (this.language.name === "tsx") {
      this.nodeInfos.push(...TypeScript.typescript.nodeTypeInfo);
      this.nodeInfos = uniqBy(this.nodeInfos, "type");
    }
    this.typesByNames = new Map(this.nodeInfos.map(n => [n.type, n]));

    // Supertypes.
    // These are a very small set of abstract type covers that tree-sitter already has predefined.
    this.expression = this.typeCover(["expression"]);
    this.statement = this.typeCover(["statement"]);
    this.declaration = this.typeCover(["declaration"]);

    // Self-made supertypes.
    // These don't have a predefined supertype.
    this.function = this.typeCover(this.getMatchingNodeTypes(/function|method/));
    this.clazz = this.typeCover(this.getMatchingNodeTypes(/class/));
    this.scopeOwner = this.typeCover(this.getAllScopeOwnerTypes());
    this.jsx = this.typeCover(this.getMatchingNodeTypes(/jsx/));
    this.constant = this.typeCover(["string", "number", "regex", "null", "true", "false", "undefined"]);
  }

  typeCover(types: Array<NodeTypeName | TypeCover>): TypeCover {
    return new TypeCover(this, types);
  }

  getConcreteTypeNames(...types: NodeTypeName[]): NodeTypeName[] {
    return types.flat().flatMap(t => {
      const info = this.getNodeTypeInfo(t);
      if (!info) {
        throw new Error(`Unknown type for language ${this.language.name}: ${t}`);
      }
      if (!info.subtypes) return [t];
      return this.getConcreteTypeNames(...info.subtypes.map((s: BaseNode) => s.type));
    });
  }

  getNodeTypeInfo(name: string): BaseNode | any {
    return this.typesByNames.get(name);
  }

  getMatchingNodeTypes(re: RegExp): NodeTypeName[] {
    const t = this.nodeInfos;
    return t.filter(n => re.test(n.type)).map(n => n.type);
  }

  /**
   * @see https://babeljs.io/docs/babel-types#blockparent
   */
  getAllScopeOwnerTypes(): string[] {
    return difference(
      union(
        this.getAllBodyNodeTypes(),
        // Add these:
        [
          // Root node
          "program",
          // {}
          "statement_block",
        ]
      ),
      // Remove these:
      ["class", "labeled_statement", "switch_case", "switch_default"]
    );
  }

  getAllBodyNodeTypes(): string[] {
    return Array.from(
      new Set(
        this.nodeInfos
          .flatMap((n: any) =>
            Object.entries(n.fields || {}).map(([name]: [string, any]) =>
              name == "body" ? n.type : null
            )
          )
          .filter(x => !!x)
      )
    );
  }
}

if (require.main === module) {
  async function debugPrint() {
    const typescript = await import("tree-sitter-typescript");
    const l = typescript.default.typescript;
    const lang = new LanguageInfo(l);

    console.group("Expressions:");
    console.log(lang.getConcreteTypeNames("expression"));
    console.groupEnd();

    console.group(lang.getAllScopeOwnerTypes.name);
    console.log(lang.getAllScopeOwnerTypes());
    console.groupEnd();

    console.group("Declarations:");
    console.log([...lang.declaration]);
    console.groupEnd();

    // console.group("Debug all types:");
    // console.log(JSON.stringify(l.nodeTypeInfo, null, 2));
    // console.groupEnd();
  }
  debugPrint();
}
