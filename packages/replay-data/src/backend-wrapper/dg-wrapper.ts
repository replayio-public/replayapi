import * as fs from "fs";
import * as path from "path";

import { spawnAsync } from "../util/spawnAsync";
import { AnalyzeDependenciesResult, AnalyzeDependenciesSpec } from "./backend-types";

export async function DGAnalyzeDependencies({
  apiKey,
  spec,
}: {
  apiKey: string;
  spec: AnalyzeDependenciesSpec;
}): Promise<AnalyzeDependenciesResult> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL env var must be set");
  }

  const experimentFolder = path.resolve(__dirname, "../../../..", "backend-data/dg");
  const experimentId = "01";

  const replayDir = process.env.REPLAY_DIR;
  if (!replayDir) {
    throw new Error("REPLAY_DIR env var must be set");
  }
  const backendDir = path.join(replayDir, "backend");

  // Create experiment folder
  fs.mkdirSync(experimentFolder, { recursive: true });

  const pathPrefix = `${experimentFolder}/dg-${experimentId}`;
  const cacheDir = `${pathPrefix}-cache`;
  const specFile = `${pathPrefix}-spec.json`;

  // Write spec file
  fs.writeFileSync(specFile, JSON.stringify(spec, null, 2));

  // Run analysis
  const { stdout } = await spawnAsync(
    "ts-node",
    ["scripts/analysis/dependency-graph.ts", "-k", apiKey, "-d", cacheDir, "-s", specFile],
    { cwd: backendDir }
  );
  const dependencies = parseDependencyOutput(stdout.toString());
  return dependencies;
}

function parseDependencyOutput(stdout: string) {
  const start = stdout.indexOf("Dependencies result:  {");
  const end = stdout.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("Could not find dependency data markers in stdout");
  }

  const outputDataString = stdout.slice(start + "Dependencies result:  ".length, end + 1);
  try {
    // return JSON.parse(outputDataString);
    // NOTE: The script currently does not output valid JSON.
    return eval(`(${outputDataString})`);
  } catch (error: any) {
    throw new Error(`Failed to parse DG stdout "${error.message}". Input: ${outputDataString}`);
  }
}
