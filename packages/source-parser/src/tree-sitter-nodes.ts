/* Copyright 2020-2024 Record Replay Inc. */
/**
 * @file Mostly generalized node type utilities.
 */

import difference from "lodash/difference";
import isString from "lodash/isString";
import union from "lodash/union";
import Parser, { SyntaxNode } from "tree-sitter";

import { BaseNode, Language } from "./tree-sitter-types";

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
  readonly typesByNames: Map<NodeTypeName, BaseNode>;

  expression: TypeCover;
  statement: TypeCover;
  function: TypeCover;
  clazz: TypeCover;
  scopeOwner: TypeCover;

  constructor(languageOrParser: Language | Parser) {
    this.language = getLanguage(languageOrParser);
    this.typesByNames = new Map(this.language.nodeTypeInfo.map(n => [n.type, n]));

    // Supertypes.
    // These are a very small set of abstract type covers that tree-sitter already has predefined.
    this.expression = this.typeCover(
      this.getNodeTypeInfo("expression").subtypes!.map((s: BaseNode) => s.type)
    );
    this.statement = this.typeCover(
      this.getNodeTypeInfo("statement").subtypes!.map((s: BaseNode) => s.type)
    );

    // Self-made supertypes.
    // These don't have a predefined supertype.
    this.function = this.typeCover(this.getMatchingNodeTypes(/function|method/));
    this.clazz = this.typeCover(this.getMatchingNodeTypes(/class/));
    this.scopeOwner = this.typeCover(this.getAllScopedNodeTypes());
  }

  typeCover(types: Iterable<NodeTypeName | TypeCover>): TypeCover {
    return new TypeCover(this, types);
  }

  getConcreteTypeNames(...types: NodeTypeName[]): NodeTypeName[] {
    return types.flatMap(t => {
      const info = this.getNodeTypeInfo(t);
      if (!info.subtypes) return [t];
      return info.subtypes.map((s: BaseNode) => s.type);
    });
  }

  getNodeTypeInfo(name: string): any {
    return this.typesByNames.get(name);
  }

  getMatchingNodeTypes(re: RegExp): NodeTypeName[] {
    const t = this.language.nodeTypeInfo;
    return t.filter(n => re.test(n.type)).map(n => n.type);
  }

  /**
   * @see https://babeljs.io/docs/babel-types#blockparent
   */
  private getAllScopedNodeTypes(): string[] {
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
        this.language.nodeTypeInfo
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

async function printAllBodyNodeTypes() {
  const l = await import("tree-sitter-javascript");
  const lang = new LanguageInfo(l);
  console.log(lang.getAllBodyNodeTypes());
}

if (require.main === module) {
  printAllBodyNodeTypes();
}
