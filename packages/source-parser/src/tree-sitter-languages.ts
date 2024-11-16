/* Copyright 2020-2024 Record Replay Inc. */
/**
 * @file Mostly generalized node type utilities.
 */

import isString from "lodash/isString";
import Parser, { SyntaxNode } from "tree-sitter";

import { BaseNode, Language } from "./tree-sitter-types";

export type LanguageTypeName = string;

/** ###########################################################################
 * {@link TypeCover}
 * ##########################################################################*/

export class TypeCover implements Iterable<LanguageTypeName> {
  private types: Set<LanguageTypeName>;

  constructor(
    public readonly language: LanguageInfo,
    types: Iterable<LanguageTypeName | TypeCover>
  ) {
    const allTypes = new Set(
      Array.from(types).flatMap(t => (t instanceof TypeCover ? Array.from(t.types) : t))
    );

    // Type names can include abstract types, which, in turn also need to be looked up:
    const concreteTypes = this.language.getConcreteTypeNames(...allTypes);
    this.types = new Set(concreteTypes);
  }

  has(nodeOrType: LanguageTypeName): boolean;
  has(nodeOrType: SyntaxNode): boolean;
  has(nodeOrType: LanguageTypeName | SyntaxNode): boolean {
    return this.types.has(isString(nodeOrType) ? nodeOrType : nodeOrType.type);
  }

  [Symbol.iterator](): Iterator<LanguageTypeName> {
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
  readonly typesByNames: Map<LanguageTypeName, BaseNode>;

  expression: TypeCover;
  statement: TypeCover;
  function: TypeCover;
  clazz: TypeCover;

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
  }

  typeCover(types: Iterable<LanguageTypeName | TypeCover>): TypeCover {
    return new TypeCover(this, types);
  }

  getConcreteTypeNames(...types: LanguageTypeName[]): LanguageTypeName[] {
    return types.flatMap(t => {
      const info = this.getNodeTypeInfo(t);
      if (!info.subtypes) return [t];
      return info.subtypes.map((s: BaseNode) => s.type);
    });
  }

  getNodeTypeInfo(name: string): any {
    return this.typesByNames.get(name);
  }

  getMatchingNodeTypes(re: RegExp): string[] {
    const t = this.language.nodeTypeInfo;
    return t.filter(n => re.test(n.type)).map(n => n.type);
  }
}
