module.exports = function globalTeardown() {
  // TODO: This does not work. For some reason, we don't get `window` in this context, despite `bootstrap.ts` setting it up.
  // NOTE: `disconnect` is a debug utility added in `devtools`. It should close the session socket.
  globalThis.window?.disconnect?.();
}
