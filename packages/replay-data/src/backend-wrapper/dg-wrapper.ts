import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

import {
  AnalyzeDependenciesResult,
  AnalyzeDependenciesSpec,
} from "./backend-types";

export async function DGAnalyzeDependencies({
  apiKey,
  spec,
}: {
  apiKey: string;
  spec: AnalyzeDependenciesSpec;
}): Promise<AnalyzeDependenciesResult> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL env var must be set");
    process.exit(1);
  }

  const experimentFolder = "./experiments/dg-experiments";
  const experimentId = "01";

  const replayDir = process.env.REPLAY_DIR;
  if (!replayDir) {
    console.error("REPLAY_DIR env var must be set");
    process.exit(1);
  }
  const backendDir = path.join(replayDir, "backend");

  // Create experiment folder
  fs.mkdirSync(experimentFolder, { recursive: true });

  const pathPrefix = `${experimentFolder}/dg-${experimentId}`;
  const cacheDir = `${pathPrefix}-cache`;
  const specFile = `${pathPrefix}-spec.json`;

  // Write spec file
  fs.writeFileSync(specFile, JSON.stringify(spec, null, 2));
  console.log(`Using specfile ${specFile} ...`);

  // Run analysis
  const cmd = `AWS_PROFILE=ReplayProdDev ts-node scripts/analysis/dependency-graph.ts -k ${apiKey} -d "${cacheDir}" -s "${specFile}"`;
  const stdout = execSync(cmd, { cwd: backendDir, encoding: "utf8" });
  const dependencies = parseDependencyOutput(stdout.toString());
  return dependencies;
}

function parseDependencyOutput(stdout: string) {
  try {
    const start = stdout.indexOf("Dependencies result:  {");
    const end = stdout.lastIndexOf("}");

    if (start === -1 || end === -1) {
      throw new Error("Could not find dependency data markers in stdout");
    }

    // Extract everything between the markers and parse as JSON
    const jsonString = stdout.slice(start + "Dependencies result:  ".length, end + 1);
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Failed to parse stdout:", error);
    return null;
  }
}
