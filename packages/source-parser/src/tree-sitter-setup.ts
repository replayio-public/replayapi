/* Copyright 2020-2024 Record Replay Inc. */

import assert from "assert";
import { extname } from "path";

import { ContentType } from "@replayio/protocol";
import Parser from "tree-sitter";
import HTML from "tree-sitter-html";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";

import { Language } from "./tree-sitter-types";

const LANGUAGE_EXTENSIONS = {
  javascript: ["js", "jsx", "mjs", "cjs"],
  html: ["html", "htm"],
} as const;

const LanguagesByFileExtension = new Map<string, Language>([
  ...LANGUAGE_EXTENSIONS.javascript.map(ext => [ext, JavaScript] as const),
  ...["ts"].map(ext => [ext, TypeScript.typescript] as const),
  ...["tsx", "mts", "cts"].map(ext => [ext, TypeScript.tsx] as const),
  ...LANGUAGE_EXTENSIONS.html.map(ext => [ext, HTML] as const),
]);

function getFileExtension(uri: string): string {
  try {
    // Parse url file extension.
    const url = new URL(uri);
    const pathname = url.pathname;
    return extname(pathname).toLowerCase().replace(/^\./, "");
  } catch {
    // Fallback for non-URL strings (local paths).
    return extname(uri).toLowerCase().replace(/^\./, "");
  }
}

function getTreeSitterLanguage(url: string, contentType?: ContentType): Language | null {
  if (contentType === "text/html") {
    return HTML;
  }

  const extension = getFileExtension(url);
  const languageModule = LanguagesByFileExtension.get(extension);
  if (!languageModule) {
    return null;
  }

  try {
    return languageModule;
  } catch (error) {
    console.error(`Failed to load language for extension ${extension}:`, error);
    return null;
  }
}

function createTreeSitterParser(url: string, contentType?: ContentType): Parser {
  const language = getTreeSitterLanguage(url, contentType);

  assert(language);

  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}

export { getTreeSitterLanguage, createTreeSitterParser };
