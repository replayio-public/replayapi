import fs from "fs";
import path from "path";

import type { Config } from "@jest/types";
import { pathsToModuleNameMapper } from "ts-jest";

Error.stackTraceLimit = Infinity;

const RootDir = __dirname;

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

const config: Config.InitialOptions = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: ["**/__tests__/**/*.+(ts|tsx|js)", "**/?(*.)+(spec|test).+(ts|tsx|js)"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          // Enable JSX parsing, so we don't error out on JSX syntax.
          jsx: "react",
        },
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
  moduleNameMapper: {
    "\\.(css|less|scss|sass|svg|png|jpg|jpeg|gif|webp|mp4|mp3|wav)$": path.resolve(
      RootDir,
      "third-party/mocks/empty.js"
    ),
    ...pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
      prefix: RootDir + "/",
    }),
  },
  transformIgnorePatterns: ["node_modules"],

  // 100s timeout for long-running API fetching tests.
  // NOTE: This shows a false warning (will be fixed in jest@30).
  testTimeout: 100 * 1000,

  testPathIgnorePatterns: ["node_modules", ".yalc", "workspace-for-testing"],
};

export default config;
