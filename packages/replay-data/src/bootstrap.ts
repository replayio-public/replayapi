/* Copyright 2020-2024 Record Replay Inc. */

import WebSocket from "ws";
import os from "os";

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
})();

