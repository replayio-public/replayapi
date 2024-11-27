import { SyntaxNode } from "@replay/source-parser/src/tree-sitter-types";

import RecordedValue from "../values/RecordedValue";

export default class DynamicBinding {
  constructor(
    public readonly name: string,
    public readonly node: SyntaxNode,
    public readonly value: RecordedValue
  ) {}
}
