/* Copyright 2020-2024 Record Replay Inc. */

import { createRequire } from "module";
import os from "os";

import WebSocket from "ws";

// @ts-expect-error - import.meta is handled by build tooling
const require = createRequire(import.meta.url);
const Module = require("module");

/**
 * Hackfixy JS patching.
 */
function ignoreMultiMediaImports() {
  const originalJsHandler = Module._extensions[".js"];
  Module._extensions[".js"] = function (module: any, filename: string) {
    // console.log(`Custom handler for: ${filename}`);
    if (filename.match(/\.(css|scss|svg)$/)) {
      // noop
    } else {
      // Call the original handler
      originalJsHandler(module, filename);
    }
  };
}

/**
 * Hackfixes for some of our dependencies.
 */
(function hackfixGlobals() {
  /* @ts-ignore */
  globalThis.window = globalThis;

  /* @ts-ignore */
  globalThis.WebSocket = WebSocket;

  /* @ts-ignore */
  globalThis.location = {
    href: "https://app.replay.io",
  };

  /* @ts-ignore */
  globalThis.navigator ||= {
    userAgent: os.type(),
  };

  /* @ts-ignore */
  globalThis.addEventListener = () => {};

  /* @ts-ignore */
  globalThis.WebSocket = WebSocket;

  /* @ts-ignore */
  globalThis.Node = {
    ELEMENT_NODE: 1,
  };

  ignoreMultiMediaImports();
})();
