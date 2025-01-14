/* Copyright 2020-2024 Record Replay Inc. */

import fs from "fs/promises";
import path from "path";

import { RecordingId } from "@replayio/protocol";
import createDebug from "debug";
import defaultsDeep from "lodash/defaultsDeep";

import { isReplayDevMode } from "../devMode";
import NestedError from "../util/NestedError";
import { deterministicObjectHash } from "../util/objectUtil";
import {
  DefaultHardcodedStubString,
  HardcodedDir,
  HardcodedResult,
  importHardcodedData,
  isDefaultHardcodedValueStub,
  sanitizeHardcodedPath,
} from "./hardcodedCore";

const debug = createDebug("replay:hardcodedResults");

type HardcodeHandler = (existingData: any) => Promise<HardcodedResult>;
type HardcodeHandlerOrResult = HardcodedResult | HardcodeHandler;

let _hardcodeHandlers = new Map<RecordingId, any>();

function getHardcodedPath(recordingId: RecordingId, name: string, inputString: string | null) {
  let filePath = path.join(HardcodedDir, recordingId, name);
  if (inputString) {
    filePath = path.join(filePath, inputString);
  }
  filePath += ".ts";
  filePath = sanitizeHardcodedPath(filePath);
  return filePath;
}

/**
 * Look up the *.ts file and return its default export.
 * @returns A function with custom inputs or hardcoded data.
 */
async function getHardcodeHandler(
  recordingId: RecordingId,
  name: string,
  inputString: string | null,
  force: boolean
): Promise<HardcodeHandlerOrResult> {
  const filePath = getHardcodedPath(recordingId, name, inputString);
  let result = _hardcodeHandlers.get(filePath);
  if (!result) {
    try {
      result = await importHardcodedData(filePath);
      if (!result || (!(result instanceof Function) && typeof result !== "object")) {
        throw new Error(
          `Invalid hardcoded data file at "${filePath}" did not default-export an object or a function: ${await import(filePath)}`
        );
      }
      if (isDefaultHardcodedValueStub(result)) {
        console.error(
          `❌ [REPLAY_DATA_MISSING] hardcoded ${name} data at "${filePath}" is a stub.`
        );
      } else {
        debug(`✅ getHardcodedData ${filePath}`);
      }
      _hardcodeHandlers.set(filePath, result);
    } catch (err: any) {
      if (err.code === "ENOENT" || err.code?.includes("MODULE_NOT_FOUND")) {
        // Data is not hardcoded.
        if (force) {
          // Data should exist.
          // Create a stub file.
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, DefaultHardcodedStubString, { mode: 0o666 });
          console.error(
            `❌ [REPLAY_DATA_MISSING] Hardcoded ${name} data not found for "${filePath}". Created stub.`
          );
        } else {
          debug(`❌ getHardcodedData ${filePath}`);
        }
        _hardcodeHandlers.set(filePath, (result = {}));
      } else {
        throw new NestedError(
          `readAllHardcodedData failed (${err.code}) for recordingId=${recordingId}, name=${name}, inputString=${inputString}`,
          err
        );
      }
    }
  }
  return result;
}

function checkHardcodedResult(
  res: HardcodedResult,
  recordingId: RecordingId,
  name: string,
  inputString: string | null
) {
  if (typeof res !== "object" || res === null) {
    const filePath = getHardcodedPath(recordingId, name, inputString);
    throw new Error(`Invalid hardcoded result must be object at "${filePath}": ${res}`);
  }
}

export async function lookupHardcodedData(
  recordingId: RecordingId,
  name: string,
  input: HardcodedResult | null,
  existingResult: HardcodedResult | null,
  force?: boolean
): Promise<HardcodedResult> {
  const inputString = input ? deterministicObjectHash(input) : null;
  const actualForce = force && isReplayDevMode(); // We only force in dev mode.
  const hardcodeResultOrHandler = await getHardcodeHandler(
    recordingId,
    name,
    inputString,
    !!actualForce
  );

  let res: HardcodedResult;
  if (hardcodeResultOrHandler instanceof Function) {
    // Hardcoded function, returining an object.
    res = await hardcodeResultOrHandler(existingResult);
    checkHardcodedResult(res, recordingId, name, inputString);
  } else if (hardcodeResultOrHandler) {
    // Hardcoded object.
    res = hardcodeResultOrHandler;
    checkHardcodedResult(res, recordingId, name, inputString);
    res = defaultsDeep(existingResult || {}, res);
  } else {
    // No hardcoded data.
    res = existingResult || {};
  }
  return res;
}

type WrapAsyncWithHardcodedDataParamsBase<O extends HardcodedResult> = {
  recordingId: RecordingId;
  name: string;
  force?: boolean;
};

export type WrapAsyncWithHardcodedDataParamsWithInput<
  I extends HardcodedResult | undefined,
  O extends HardcodedResult,
> = WrapAsyncWithHardcodedDataParamsBase<O> & {
  input: I;
  cb: (input: I) => Promise<O | undefined>;
};

export type WrapAsyncWithHardcodedDataParamsWithoutInput<O extends HardcodedResult> =
  WrapAsyncWithHardcodedDataParamsBase<O> & {
    cb: () => Promise<O | undefined>;
  };

export async function wrapAsyncWithHardcodedData<
  I extends HardcodedResult | undefined,
  O extends HardcodedResult,
>(options: WrapAsyncWithHardcodedDataParamsWithInput<I, O>): Promise<O>;
export async function wrapAsyncWithHardcodedData<O extends HardcodedResult>(
  options: WrapAsyncWithHardcodedDataParamsWithoutInput<O>
): Promise<O>;
export async function wrapAsyncWithHardcodedData<
  I extends HardcodedResult | undefined,
  O extends HardcodedResult,
>(
  options:
    | WrapAsyncWithHardcodedDataParamsWithInput<I, O>
    | WrapAsyncWithHardcodedDataParamsWithoutInput<O>
): Promise<O> {
  const input: I | undefined = "input" in options ? options.input : undefined;
  try {
    const existingResult: O | null = (await ("input" in options ? options.cb(options.input) : options.cb())) || null;
    return (await lookupHardcodedData(
      options.recordingId,
      options.name,
      input ?? null,
      existingResult,
      options.force
    )) as O;
  } catch (err: any) {
    console.error(
      `❌ Failed to lookup hardcoded result (${options.recordingId}, ${options.name}, ${JSON.stringify(input)}): ${err.message}`
    );
    return (await lookupHardcodedData(
      options.recordingId,
      options.name,
      input ?? null,
      null,
      options.force
    )) as O;
  }
}
