import fs from "fs/promises";
import path from "path";

import SourceParser from "../SourceParser";

export async function parseSampleFile(relativePath: string): Promise<SourceParser> {
  const samplePath = path.resolve(__dirname, "../../testing/samples/", relativePath);
  const sampleSource = await fs.readFile(samplePath, "utf-8");
  const parser = new SourceParser(samplePath, sampleSource);
  parser.parse();
  return parser;
}
