import { mkdir, mkdtemp, writeFile } from "fs/promises";
import os from "os";
import path from "path";

import { ExecutionPoint } from "@replayio/protocol";
import createDebug from "debug";

import ReplaySession from "../recordingData/ReplaySession";
import { AnalysisType } from "./dependencyGraphShared";
import { AnalysisInput } from "./dgSpecs";
import { wrapAsyncWithHardcodedData } from "./hardcodedResults";
import { ExecutionDataAnalysisResult } from "./specs/executionPoint";

const debug = createDebug("replay:runAnalysis");

/**
 * TODO: Typify results based on AnalysisType, just like we have done with AnalysisInput.
 */
export type AnalysisResult = any;

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
export async function runAnalysis(
  session: ReplaySession,
  input: AnalysisInput
): Promise<AnalysisResult> {
  try {
    return await session.experimentalCommand(
      analysisExperimentalCommandMapInverted[input.analysisType],
      input.spec
    );
  } catch (err: any) {
    console.error(`Failed to run analysis ${JSON.stringify(input)}:\n  ${err.stack}`);
  }
}

export type InitialAnalysisResult = {
  point?: ExecutionPoint;
  userComment?: string;
  reactComponentName?: string;
};

export async function runInitialAnalysis(session: ReplaySession): Promise<InitialAnalysisResult> {
  const recordingId = session.getRecordingId()!;
  const analysisInput: AnalysisInput = {
    analysisType: AnalysisType.ExecutionPoint,
    spec: { recordingId },
  };
  return await wrapAsyncWithHardcodedData(recordingId, "initial-analysis", async () => {
    const analysisResults = (await runAnalysis(
      session,
      analysisInput
    )) as ExecutionDataAnalysisResult;
    const { point, commentText: userComment, reactComponentName } = analysisResults;
    return { point, userComment, reactComponentName };
  });
}
