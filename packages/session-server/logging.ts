import fs from "fs";

export function initializeLogging(): void {
  // Redirect console output to a file since we're detached
  const logFile = fs.createWriteStream("/tmp/replay-server.log", { flags: "a" });
  console.log = (...args) => {
    const message =
      args
        .map((arg: unknown): string => {
          if (arg instanceof Error) {
            return arg.message;
          }
          if (typeof arg === "string") {
            return arg;
          }
          return JSON.stringify(arg);
        })
        .join(" ") + "\n";
    logFile.write(`${new Date().toISOString()} - ${message}`);
  };
  console.error = console.log;
}
