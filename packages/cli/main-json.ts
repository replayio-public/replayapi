import "tsconfig-paths/register";

import { spawn } from "child_process";
import { readFileSync } from "fs";
import path, { join } from "path";

const ROOT_DIR = "/tmp/cli-specs";
const thisDir = __dirname;

// Get sorted values from an object, handling nested objects
function getSortedValues(obj: Record<string, any>): string[] {
  // Get top-level values first
  const topValues = Object.keys(obj)
    .sort()
    .filter(key => typeof obj[key] !== "object" || obj[key] === null)
    .map(key => String(obj[key]));

  // Then get nested values
  const nestedValues = Object.keys(obj)
    .sort()
    .filter(key => typeof obj[key] === "object" && obj[key] !== null)
    .flatMap(key => getSortedValues(obj[key]));

  return [...topValues, ...nestedValues];
}

// Read and parse input file
try {
  const inputPath = join(thisDir, 'input.json');
  const inputData = readFileSync(inputPath, 'utf8');
  const input = JSON.parse(inputData);

  if (!input.tool) {
    console.error("Tool missing in spec");
    process.exit(1);
  }

  const outputName = getSortedValues(input).join("-");
  const outputPath = `${ROOT_DIR}/result-${outputName}.json`;

  const params = Object.entries(input.params)
    .map(([key, value]) => `--${key} ${value}`)
    .join(" ");

  // Change to script directory and run command
  // 011f1663-6205-4484-b468-5ec471dc5a31
  // 78858008544006974830969978873708558n
  spawn(`tsx -r tsconfig-paths/register "${path.join(thisDir, "main.ts")}" ${input.tool} ${params}`, {
    shell: true,
    stdio: "inherit",
  }).on("close", (error, signal) => {
    if (error || signal) {
      console.error(`Error running command: error=${error} signal=${signal}`);
      process.exit(1);
    }
    console.log(`Done. Result: ${outputPath}`);
  });

} catch (error) {
  if (error instanceof Error) {
    console.error(`Error reading or parsing input file: ${error.message}`);
  } else {
    console.error('An unknown error occurred');
  }
  process.exit(1);
}
