const MarkerStart = "MARKER-gJNVWbR2W1FRxa5zkvVZtXcrep2DFHjUUNjQJErE-START";
const MarkerEnd = "MARKER-gJNVWbR2W1FRxa5zkvVZtXcrep2DFHjUUNjQJErE-END";

export function printCommandResult(result: Record<string, any>): void {
  printResult({ result });
}

export function printCommandError(errorMessage: string, errorDetails?: string): void {
  printResult({ error: errorMessage, errorDetails });
}

function printResult(obj: Record<string, any>) {
  const shouldPrintMarkers = process.env.REPLAYAPI_PRINT_MARKERS;
  if (shouldPrintMarkers) console.log(MarkerStart);
  console.log(JSON.stringify(obj, null, 2));
  if (shouldPrintMarkers) console.log(MarkerEnd);
}

export function parseMarkedOutput(output: string): Record<string, any> | null {
  const parts = output.split(new RegExp(`${MarkerStart}|${MarkerEnd}`));
  if (parts.length < 3) return null;
  
  try {
    return JSON.parse(parts[1].trim());
  } catch {
    return null;
  }
}
