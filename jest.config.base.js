const fs = require("fs");
const path = require("path");
const { parse } = require("jsonc-parser");

Error.stackTraceLimit = Infinity;

const Root = __dirname;
const RelativeRoot = "../..";

function relativeToRoot(p) {
  return path.join(RelativeRoot, p);
}

const rawJsonc = fs.readFileSync(path.resolve(Root, "tsconfig.json")).toString("utf-8");

let tsconfig;
try {
  // Read jsonc file.
  tsconfig = parse(rawJsonc, "utf-8");
} catch (e) {
  console.error(
    "\n\n\n\nERROR PARSING tsconfig.json: We are using a rudimentary JSONC parser. No trailing commas or other fancy syntax allowed.\n\n\n\n"
  );
  throw e;
}



// Convert paths to root (tsconfig files usually convert all paths relative to their own location, so we have to do it manually):
tsconfig.compilerOptions.paths = transformObjectPaths(tsconfig.compilerOptions.paths, (p) => relativeToRoot(p));

const moduleNameMapper = require("tsconfig-paths-jest")(tsconfig);
// const moduleNameMapper = tsconfig.compilerOptions.paths;

module.exports = {
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
  moduleNameMapper,
  silent: false,
  verbose: true,
  transformIgnorePatterns: [
    "node_modules"
  ],
  // 100s for long-running API fetching tests
  testTimeout: 100 * 1000,
};

function transformObjectPaths(paths, cb) {
  return {
    ...Object.entries(paths).reduce((acc, [key, paths]) => {
      acc["^" + key] = paths.map(cb);
      return acc;
    }, {}),
  };
}
