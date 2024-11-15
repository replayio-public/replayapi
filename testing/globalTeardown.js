module.exports = function globalTeardown() {
  // TODO: This does not work. For some reason, we don't get `window` in this context, despite `bootstrap.ts` setting it up.
  // NOTE: This is a debug functionality added in devtools to close the session socket.
  globalThis.window?.disconnect?.();
}
