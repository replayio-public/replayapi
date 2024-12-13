import { SyntaxNode } from "@replayio/source-parser/src/tree-sitter-types";
import { ValuePreview } from "../values/values";


export default class DynamicBinding {
  constructor(
    public readonly name: string,
    public readonly node: SyntaxNode,
    public readonly value: ValuePreview
  ) {}
}
