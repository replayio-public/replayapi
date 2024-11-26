/**
 * TODO: We should print a marker to increase chances of results getting parsed correctly.
 */
const Marker = "--gJNVWbR2W1FRxa5zkvVZtXcrep2DFHjUUNjQJErE";

export function printCommandResult(result: Record<string, any>): void {
  printResult({ result });
}

export function printCommandError(errorMessage: string, errorDetails?: string): void {
  printResult({ error: errorMessage, errorDetails });
}

function printResult(obj: Record<string, any>) {
  console.log(JSON.stringify(obj, null, 2));
}
