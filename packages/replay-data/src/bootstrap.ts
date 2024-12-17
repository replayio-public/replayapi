/* Copyright 2020-2024 Record Replay Inc. */

import { createRequire } from "module";
import os from "os";
import { pathToFileURL } from "url";

import WebSocket from "ws";

/**
 * Hackfixy JS patching.
 */
function ignoreMultiMediaImports() {
  const fileUrl = pathToFileURL(__filename).toString();
  const require = createRequire(fileUrl);
  const Module = require("module");
  const originalJsHandler = Module._extensions[".js"];
  Module._extensions[".js"] = function (module: any, filename: string) {
    // console.log(`Custom handler for: ${filename}`);
    if (/\.(css|scss|svg)$/.exec(filename)) {
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
