import fs from "fs";
import path from "path";

import type { Config } from "@jest/types";
// TODO: Use `pathsToModuleNameMapper` instead.
// @ts-ignore
import tsconfigPaths from "tsconfig-paths-jest";

Error.stackTraceLimit = Infinity;

const RootDir = __dirname;
const RelativeRoot = "../..";

function relativeToRoot(p: string) {
  return path.join(RelativeRoot, p);
}

function transformObjectPaths(objectPaths: Record<string, string[]>, cb: (p: string) => string) {
  return {
    ...Object.entries(objectPaths).reduce<Record<string, string[]>>((acc, [key, paths]) => {
      acc["^" + key] = paths.map(cb);
      return acc;
    }, {}),
  };
}

// Read and parse tsconfig.
const rawTsconfig = fs.readFileSync(path.resolve(RootDir, "tsconfig.json")).toString("utf-8");
let tsconfig;
try {
  // NOTE: tsconfig.json is actually NOT json! It seems to allow a lot of JS syntax, including comments and trailing commas.
  const s = `(${rawTsconfig})`;
  tsconfig = eval(s);
} catch (e: any) {
  throw new Error(`\n\n\n\nERROR PARSING tsconfig.json:\n${e.stack}\n\n\n`);
}

// Convert paths to root (tsconfig files usually convert all paths relative to their own location, so we have to do it manually):
tsconfig.compilerOptions.paths = transformObjectPaths(tsconfig.compilerOptions.paths, p =>
  relativeToRoot(p)
);

// TODO: Use `pathsToModuleNameMapper` instead.
const moduleNameMapper = tsconfigPaths(tsconfig);
// const moduleNameMapper = tsconfig.compilerOptions.paths;

const config: Config.InitialOptions = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: ["**/__tests__/**/*.+(ts|tsx|js)", "**/?(*.)+(spec|test).+(ts|tsx|js)"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        // diagnostics: true,
        diagnostics: false,
      },
    ],
    // ".*\\.yalc.*": [
    //   "ts-jest",
    //   {
    //     diagnostics: false,
    //   },
    // ],
  },
  setupFilesAfterEnv: ["jest-extended/all"],
  globalTeardown: RootDir + "/testing/globalTeardown.js",
  moduleNameMapper,
  transformIgnorePatterns: ["node_modules"],

  // 100s timeout for long-running API fetching tests.
  // NOTE: This shows a false warning (will be fixed in jest@30).
  testTimeout: 100 * 1000,

  testPathIgnorePatterns: ["node_modules", ".yalc"],
};

export default config;
