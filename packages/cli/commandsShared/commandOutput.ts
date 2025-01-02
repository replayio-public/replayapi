/* Copyright 2020-2024 Record Replay Inc. */

export type CommandResultObject = Record<string, any>;

export type CommandOutputSuccess = {
  status: "Success";
  result: CommandResultObject;
};

export type CommandOutputError = {
  status: "Error";
  error?: string;
  errorDetails?: string;
};

export type CommandOutputResult = CommandOutputSuccess | CommandOutputError;

let result: CommandOutputResult | null = null;

export function printCommandResult(result: CommandResultObject): void {
  printResult({ status: "Success", result });
}

export function printCommandError(errorMessage: string, errorDetails?: string): void {
  printResult({ status: "Error", error: errorMessage, errorDetails });
}

function printResult(obj: CommandOutputResult) {
  if (result) {
    throw new Error(
      `Tried to printResult twice: ${JSON.stringify(obj)}\n (already had: ${JSON.stringify(obj)})`
    );
  }
  result = obj;
  console.log(JSON.stringify(obj, null, 2));
}

export function getCommandResult(): CommandOutputResult | null {
  return result;
}
