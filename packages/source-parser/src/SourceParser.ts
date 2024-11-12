/* Copyright 2020-2024 Record Replay Inc. */

import { ContentType } from "@replayio/protocol";
import Parser from "tree-sitter";

import { createTreeSitterParser } from "./tree-sitter-setup";

export default class SourceParser {
  private parser: Parser;
  constructor(url: string, contentType?: ContentType) {
    this.parser = createTreeSitterParser(url, contentType);
  }

  parse(code: string): void {
    this.parser.parse(code);
  }
}
