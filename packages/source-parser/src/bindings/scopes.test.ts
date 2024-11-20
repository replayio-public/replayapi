// parseSampleFile

import SourceParser from "../SourceParser";
import { parseSampleFile } from "../testing/readSamples";
import StaticScope from "./StaticScope";

describe("Scopes", () => {
  let parser: SourceParser;
  beforeAll(async () => {
    parser = await parseSampleFile("RulesListItem.tsx");
  });

  test("should find scopes", () => {
    const scope = parser.bindings.getScopeAt({ line: 150, column: 10 }).parent!;
    expect(scope).toBeInstanceOf(StaticScope);
    expect(scope.node.startPosition).toEqual({ row: 140, column: 1 });
    expect(scope.node.endPosition).toEqual({ line: 154, column: 1 });
    const declared = Array.from(scope.declarations.values())
      .map(d => d.name)
      .toSorted();
    expect(declared).toEqual(["index", "inheritedSource", "style"].toSorted());
  });
});
