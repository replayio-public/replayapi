/* Copyright 2020-2024 Record Replay Inc. */

import isString from "lodash/isString";

/**
 * Nested Error.
 * Based on `nested-error-stacks`, but in TS.
 *
 * @see https://github.com/Domiii/dbux/tree/master/dbux-common/src/NestedError.js
 */
class NestedError extends Error {
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  constructor(message: string | Error, cause?: any) {
    if (message instanceof Error) {
      // No message, only cause.
      cause = message;
      message = "";
    } else if (isString(cause)) {
      cause = {
        name: "ThrownString",
        message: cause + "",
        stack: cause + "",
      };
    } else {
      cause = cause!;
    }

    // hackfix: we also nest `message`, because the custom `stack` is ignored in some environments (e.g. jest (i.e. vm2))
    const nestedMsg = (cause.message && `\n  (Caused By: ${cause.message})`) || "";
    super(`${message}${nestedMsg}`);

    this.name = "NestedError";
    this.cause = cause;

    const s = this.stack! + "\n\n  [Caused By] " + cause.stack!;

    Object.defineProperty(this, "stack", {
      value: s,
    });
  }
}

export default NestedError;
