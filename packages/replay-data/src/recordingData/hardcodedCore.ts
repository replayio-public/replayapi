/* Copyright 2020-2024 Record Replay Inc. */

import path from "path";

import isEqual from "lodash/isEqual";

export const DefaultHardcodedValueStub = {};
export const DefaultHardcodedStubString = `export default ${JSON.stringify(DefaultHardcodedValueStub)};`;

export type HardcodeInput = Record<string, any>;
export type HardcodedResult = Record<string, any>;

export const HardcodedDir = path.join(__dirname, "hardcodedData");

export function isDefaultHardcodedValueStub<I extends HardcodeInput>(content: I): boolean {
  return isEqual(content, DefaultHardcodedValueStub);
}

export async function importHardcodedData(filePath: string): Promise<HardcodedResult | undefined> {
  const imported = await import(filePath);
  return imported?.default;
}

export function sanitizeHardcodedPath(filePath: string): string {
  return filePath.replace(/[^a-zA-Z0-9-_./]/g, "_");
}
