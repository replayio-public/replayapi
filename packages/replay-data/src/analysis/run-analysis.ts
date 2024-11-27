import { mkdir, mkdtemp, writeFile } from "fs/promises";
import os from "os";
import path from "path";

import ReplaySession, { getApiKey } from "../recording-data/ReplaySession";
import { exists } from "../util/fs-util";
import { spawnAsync } from "../util/spawnAsync";
import { BACKEND_DIR } from "../backend-shared";
import { AnalysisType } from "./dependency-graph-shared";
import { AnalysisInput } from "./dg-specs";
import { ExecutionDataAnalysisResult } from "./specs/execution-point";

/**
 * TODO: Typify results based on AnalysisType, just like we have done with AnalysisInput.
 */
export type AnalysisResult = any;

const TsRunner = "ts-node";

async function prepareAnalysisBase(): Promise<{ replayDir: string }> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL env var must be set");
  }
  const replayDir = process.env.REPLAY_DIR;
  if (!replayDir) {
    throw new Error("REPLAY_DIR env var must be set");
  }
  return { replayDir };
}

// Base configuration function that handles common setup
export async function prepareAnalysisForScript(
  analysisName: string,
  spec: Record<string, any>
): Promise<{ cacheDir: string; specFile: string }> {
  const { replayDir } = await prepareAnalysisBase();

  // Create a temporary directory with a unique name
  const tmpBaseDir = path.join(os.tmpdir(), "analysis-");
  const experimentFolder = await mkdtemp(tmpBaseDir);
  const experimentId = "01";

  // Set up analysis specs directory within replay directory
  const specsDir = path.join(replayDir, "replay-analysis-specs", analysisName);
  await mkdir(specsDir, { recursive: true });

  // Define paths using the temporary directory for results
  const pathPrefix = path.join(experimentFolder, `${analysisName}-${experimentId}`);
  const cacheDir = `${pathPrefix}-cache`;
  const specFile = `${pathPrefix}-spec.json`;

  // Write spec file in both locations
  const specContent = JSON.stringify(spec, null, 2);
  await writeFile(specFile, specContent);

  // Create cache directory
  await mkdir(cacheDir, { recursive: true });

  return {
    cacheDir,
    specFile,
  };
}

async function runScript(scriptFile: string, scriptArgs: string[]) {
  if (!(await exists(BACKEND_DIR))) {
    throw new Error(`Backend directory not found: ${BACKEND_DIR}`);
  }
  // Run analysis
  const scriptPath = path.join("scripts/analysis/", scriptFile);
  await spawnAsync(TsRunner, [scriptPath, ...scriptArgs], {
    cwd: BACKEND_DIR,
  });
}

/**
 * Run the given analysis via a script in the local `backend` repo.
 * NOTE: We have this for a local dev loop that does not require deploying backend changes.
 */
export async function runAnalysisScript(input: AnalysisInput): Promise<AnalysisResult> {
  const { cacheDir, specFile } = await prepareAnalysisForScript(input.analysisType, input.spec);

  // Run analysis
  let scriptFile: string;
  let scriptArgs = ["-k", getApiKey(), "-d", cacheDir, "-s", specFile]; // default args.
  switch (input.analysisType) {
    case AnalysisType.Dependency:
      scriptFile = "dependency-graph.ts";
      break;
    case AnalysisType.ExecutionPoint:
      scriptFile = "execution-data.ts";
      break;
    default:
      throw new Error(`Unsupported analysis type: ${input.analysisType}`);
  }

  const scriptPath = path.join("scripts/analysis/", scriptFile);
  const { stdout } = await spawnAsync(TsRunner, [scriptPath, ...scriptArgs], {
    cwd: BACKEND_DIR,
  });

  const dependencies = parseDependencyOutput(stdout.toString());
  return dependencies;
}

const analysisExperimentalCommandMap: Record<string, AnalysisType> = {
  analyzeDependencies: AnalysisType.Dependency,
  runPerformanceAnalysis: AnalysisType.Performance,
  getReactStateChanges: AnalysisType.ReactStateChanges,
  rerecordCompare: AnalysisType.RerecordCompare,
  ["analyze" + AnalysisType.ExecutionPoint]: AnalysisType.ExecutionPoint,
};

const analysisExperimentalCommandMapInverted = Object.fromEntries(
  Object.entries(analysisExperimentalCommandMap).map(([k, v]) => [v, k])
) as Record<AnalysisType, string>;

/**
 * Run the given analysis via `experimentalCommand`.
 */
export async function runAnalysisExperimentalCommand(
  session: ReplaySession,
  input: AnalysisInput
): Promise<AnalysisResult> {
  return session.experimentalCommand(
    analysisExperimentalCommandMapInverted[input.analysisType],
    input.spec
  );
}

function parseDependencyOutput(stdout: string): any {
  const startString = " result:  ";
  const start = stdout.indexOf(startString + "{");
  const end = stdout.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("Could not find dependency data markers in stdout");
  }

  const outputDataString = stdout.slice(start + startString.length, end + 1);
  try {
    // NOTE: The script currently does not output valid JSON, so we need to use eval instead.
    return eval(`(${outputDataString})`);
  } catch (error: any) {
    throw new Error(`Failed to parse DG stdout "${error.message}". Input: ${outputDataString}`);
  }
}
