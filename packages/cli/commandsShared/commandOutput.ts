/* Copyright 2020-2024 Record Replay Inc. */

// TODO: Remove the marker-based logic and use the json wrapper instead.
const MarkerStart = "MARKER-gJNVWbR2W1FRxa5zkvVZtXcrep2DFHjUUNjQJErE-START";
const MarkerEnd = "MARKER-gJNVWbR2W1FRxa5zkvVZtXcrep2DFHjUUNjQJErE-END";

export type CommandOutputSuccess = {
  status: "Success";
  result: Record<string, any>;
};

export type CommandOutputError = {
  status: "Error";
  error?: string;
  errorDetails?: string;
};

export type CommandOutputOther = {
  status: string;
};

export type CommandOutputResult = CommandOutputSuccess | CommandOutputError | CommandOutputOther;

let result: CommandOutputResult | null = null;

export function printCommandResult(result: CommandOutputResult): void {
  printResult(result);
}

export function printCommandError(errorMessage: string, errorDetails?: string): void {
  printResult({ status: "Error", error: errorMessage, errorDetails });
}

function printResult(obj: CommandOutputResult) {
  if (result) {
    throw new Error(
      `Tried to printResult twice with: ${JSON.stringify(obj)}\n (already had: ${JSON.stringify(obj)})`
    );
  }
  result = obj;
  const shouldPrintMarkers = process.env.REPLAYAPI_PRINT_MARKERS;
  if (shouldPrintMarkers) console.log(MarkerStart);
  console.log(JSON.stringify(obj, null, 2));
  if (shouldPrintMarkers) console.log(MarkerEnd);
}

export function parseMarkedOutput(output: string): CommandOutputResult | null {
  const parts = output.split(new RegExp(`${MarkerStart}|${MarkerEnd}`));
  if (parts.length < 3) return null;

  try {
    return JSON.parse(parts[1].trim());
  } catch {
    return null;
  }
}

export function getCommandResult(): CommandOutputResult | null {
  return result;
}
