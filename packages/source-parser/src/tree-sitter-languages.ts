/* Copyright 2020-2024 Record Replay Inc. */
/**
 * @file Mostly generalized node type utilities.
 */

import Parser from "tree-sitter";

import { BaseNode, Language } from "./tree-sitter-types";


export interface LanguageTypeCovers {
  expression: string[];
  statement: string[];
  function: string[];
}

export function makeNodeTypeCovers(parser: Parser): LanguageTypeCovers {
  const t = (parser.getLanguage() as Language).nodeTypeInfo;
  return {
    // Supertypes.
    // These are a very small set of abstract type covers that tree-sitter already has predefined.
    expression: (t.find(n => n.type === "expression") as any)!.subtypes!.map(
      (s: BaseNode) => s.type
    ),
    statement: (t.find(n => n.type === "statement") as any)!.subtypes!.map((s: BaseNode) => s.type),

    // Self-made supertypes.
    // These don't have a predefined supertype.
    function: t.filter(n => /function|method/.test(n.type)).map(n => n.type),
  };
}
