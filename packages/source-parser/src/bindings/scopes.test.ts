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
    const scope = parser.scopes.getScopeAt({ line: 150, column: 10 });
    expect(scope).toBeInstanceOf(StaticScope);
    expect(scope.node.startPosition).toEqual({ row: 139, column: 0 });
    expect(scope.node.endPosition).toEqual({ row: 153, column: 1 });
    const declared = Array.from(scope.declarations.values())
      .map(d => d.name)
      .sort();
    expect(declared).toEqual(["index", "inheritedSource", "style"].sort());
  });
});
