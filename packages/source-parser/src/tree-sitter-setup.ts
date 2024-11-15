/* Copyright 2020-2024 Record Replay Inc. */

import { extname } from "path";

import Parser from "tree-sitter";
import HTML from "tree-sitter-html";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import { ContentType } from "@replayio/protocol";
import assert from "assert";
import { Language } from "./tree-sitter-types";

const LANGUAGE_EXTENSIONS = {
  javascript: ["js", "jsx", "mjs", "cjs"],
  html: ["html", "htm"],
} as const;

const LanguagesByFileExtension = new Map<string, Language>([
  ...LANGUAGE_EXTENSIONS.javascript.map(ext => [ext, JavaScript] as [string, Language]),
  ...["ts"].map(ext => [ext, TypeScript.typescript] as [string, Language]),
  ...["tsx"].map(ext => [ext, TypeScript.tsx] as [string, Language]),
  ...LANGUAGE_EXTENSIONS.html.map(ext => [ext, HTML] as [string, Language]),
]);

function getFileExtension(uri: string): string {
  try {
    // Parse url file extension.
    const url = new URL(uri);
    const pathname = url.pathname;
    return extname(pathname)
      .toLowerCase()
      .replace(/^\./, '');
  } catch {
    // Fallback for non-URL strings (local paths).
    return extname(uri)
      .toLowerCase()
      .replace(/^\./, '');
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
