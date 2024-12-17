/* Copyright 2020-2024 Record Replay Inc. */

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
  console.log(JSON.stringify(obj, null, 2));
}

export function getCommandResult(): CommandOutputResult | null {
  return result;
}
