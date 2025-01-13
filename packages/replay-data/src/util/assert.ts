/* Copyright 2020-2024 Record Replay Inc. */

export function assertRecord(v: unknown): asserts v is Record<string, unknown> {
  assert(typeof v === "object", "expected argument to be an object");
  assert(
    Object.getOwnPropertySymbols(v).length === 0,
    "did not expect the object to have symbol properties"
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function assert(v: any, why = "", data?: any): asserts v {
  if (!v) {
    const error = new Error(`Assertion Failed: ${why} - ${JSON.stringify(data)}`);
    error.name = "AssertionFailure";
    debugger;
    throw error;
  }
}
