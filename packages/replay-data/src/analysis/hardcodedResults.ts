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

async function getHardcodeHandler(
  recordingId: RecordingId,
  name: string,
  inputString: string | null
): Promise<HardcodeHandlerOrResult> {
  let filePath = path.join(__dirname, "hardcoded-data", recordingId, name);
  if (inputString) {
    filePath = path.join(filePath, inputString);
  }
  filePath += ".ts";

  let result = _hardcodeHandlers.get(filePath);
  if (!result) {
    try {
      const imported = await import(filePath);
      if (
        !imported?.default ||
        (!(imported.default instanceof Function) && typeof imported.default !== "object")
      ) {
        throw new Error(`Invalid override file must default-export an object or a function: ${imported}`);
      }
      result = imported.default;
      debug(`✅ getHardcodedData ${filePath}`);
      _hardcodeHandlers.set(filePath, result);
    } catch (err: any) {
      if (err.code === "ENOENT") {
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

export async function lookupHardcodedData(
  recordingId: RecordingId,
  name: string,
  input: AnyInput | null,
  existingResult: HardcodedResult | undefined
): Promise<AnyResult> {
  const inputString = input ? deterministicObjectHash(input) : null;
  const hardcodeResultOrHandler = await getHardcodeHandler(recordingId, name, inputString);

  if (hardcodeResultOrHandler instanceof Function) {
    return await hardcodeResultOrHandler(existingResult);
  } else {
    const hardcodedResult = hardcodeResultOrHandler;
    return defaultsDeep(existingResult || {}, hardcodedResult);
  }
}

export function wrapAsyncWithHardcodedData<I, O>(
  recordingId: RecordingId,
  name: string,
  input: AnyInput,
  cb: (input: I) => Promise<O>
): Promise<O>;

export function wrapAsyncWithHardcodedData<O>(
  recordingId: RecordingId,
  name: string,
  cb: () => Promise<O>
): Promise<O>;

export async function wrapAsyncWithHardcodedData<I extends AnyInput, O extends AnyResult>(
  recordingId: RecordingId,
  name: string,
  inputOrCallback: I | (() => Promise<O>),
  cb?: (input: I) => Promise<O>
): Promise<O> {
  try {
    if (cb) {
      // First overload case
      const input = inputOrCallback as I;
      const existingResult = await cb(input);
      return (await lookupHardcodedData(recordingId, name, input, existingResult)) as O;
    } else {
      // Second overload case
      const callback = inputOrCallback as () => Promise<O>;
      const existingResult = await callback();
      return (await lookupHardcodedData(recordingId, name, null, existingResult)) as O;
    }
  } catch (err: any) {
    console.error(
      `❌ Failed to run analysis (input=${JSON.stringify(inputOrCallback)}): ${err.message}`
    );
    return (await lookupHardcodedData(
      recordingId,
      name,
      cb ? inputOrCallback : null,
      undefined
    )) as O;
  }
}
