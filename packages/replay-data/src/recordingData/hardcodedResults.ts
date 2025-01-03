import path from "path";

import { RecordingId } from "@replayio/protocol";
import createDebug from "debug";
import defaultsDeep from "lodash/defaultsDeep";

import NestedError from "../util/NestedError";
import { deterministicObjectHash } from "../util/objectUtil";

const debug = createDebug("replay:hardcodedResults");

export type AnyInput = Record<string, any>;
export type AnyResult = Record<string, any>;
type HardcodedResult = AnyResult;
type HardcodeHandler = (existingData: any) => Promise<HardcodedResult>;
type HardcodeHandlerOrResult = HardcodedResult | HardcodeHandler;

let _hardcodeHandlers = new Map<RecordingId, any>();

function getHardcodedPath(recordingId: RecordingId, name: string, inputString: string | null) {
  let filePath = path.join(__dirname, "hardcodedData", recordingId, name);
  if (inputString) {
    filePath = path.join(filePath, inputString);
  }
  filePath += ".ts";
  return filePath;
}

/**
 * Look up the *.ts file and return its default export.
 * @returns A function with custom inputs or hardcoded data.
 */
async function getHardcodeHandler(
  recordingId: RecordingId,
  name: string,
  inputString: string | null
): Promise<HardcodeHandlerOrResult> {
  const filePath = getHardcodedPath(recordingId, name, inputString);
  let result = _hardcodeHandlers.get(filePath);
  if (!result) {
    try {
      const imported = await import(filePath);
      if (
        !imported?.default ||
        (!(imported.default instanceof Function) && typeof imported.default !== "object")
      ) {
        throw new Error(
          `Invalid override file must default-export an object or a function: ${imported}`
        );
      }
      result = imported.default;
      debug(`✅ getHardcodedData ${filePath}`);
      _hardcodeHandlers.set(filePath, result);
    } catch (err: any) {
      if (err.code === "ENOENT" || err.code === "ERR_MODULE_NOT_FOUND") {
        // Data is not hardcoded.
        debug(`❌ getHardcodedData ${filePath}`);
        _hardcodeHandlers.set(filePath, (result = {}));
      } else {
        throw new NestedError(
          `readAllHardcodedData failed for recordingId=${recordingId}, name=${name}, inputString=${inputString}`,
          err
        );
      }
    }
  }
  return result;
}

function checkHardcodedResult(
  res: AnyResult,
  recordingId: RecordingId,
  name: string,
  inputString: string | null
) {
  if (typeof res !== "object" || res === null) {
    const filePath = getHardcodedPath(recordingId, name, inputString);
    throw new Error(`Invalid hardcoded result must be object at "${filePath}": ${res}`);
  }
}

async function lookupHardcodedData(
  recordingId: RecordingId,
  name: string,
  input: AnyInput | null,
  existingResult: HardcodedResult | undefined
): Promise<AnyResult> {
  const inputString = input ? deterministicObjectHash(input) : null;
  const hardcodeResultOrHandler = await getHardcodeHandler(recordingId, name, inputString);

  let res: AnyResult;
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

export function wrapAsyncWithHardcodedData<I extends AnyInput, O extends AnyResult>(
  recordingId: RecordingId,
  name: string,
  input: AnyInput,
  cb: (input: I) => Promise<O | undefined>
): Promise<O>;

export function wrapAsyncWithHardcodedData<O extends AnyResult>(
  recordingId: RecordingId,
  name: string,
  cb: () => Promise<O | undefined>
): Promise<O>;

export async function wrapAsyncWithHardcodedData<I extends AnyInput, O extends AnyResult>(
  recordingId: RecordingId,
  name: string,
  inputOrCallback: I | (() => Promise<O | undefined>),
  cbWithInput?: (input: I) => Promise<O | undefined>
): Promise<O> {
  try {
    if (cbWithInput) {
      // Overload 1: Input given.
      const input = inputOrCallback as I;
      const existingResult = await cbWithInput(input);
      return (await lookupHardcodedData(recordingId, name, input, existingResult)) as O;
    } else {
      // Overload 2: No input given.
      const cbWithoutInput = inputOrCallback as () => Promise<O | undefined>;
      const existingResult = await cbWithoutInput();
      return (await lookupHardcodedData(recordingId, name, null, existingResult)) as O;
    }
  } catch (err: any) {
    console.error(
      `❌ Failed to lookup hardcoded result (${recordingId}, ${name}, ${JSON.stringify(inputOrCallback)}): ${err.message}`
    );
    return (await lookupHardcodedData(
      recordingId,
      name,
      cbWithInput ? inputOrCallback : null,
      undefined
    )) as O;
  }
}
