import { createReplayClientForProduction } from "shared/utils/client";
import { WebSocketServer } from "ws";

import { initializeLogging } from "./logging";
import { handleRequest } from "./requests";

function startServer(recordingId: string) {
  console.log("Starting server...");
  // Create server with port 0 to let the system assign an available port
  const wss = new WebSocketServer({ port: 0 }, async () => {
    try {
      console.log("Starting replay session");

      // start the session
      const client = createReplayClientForProduction();
      const sessionId = await client.initialize(recordingId, process.env["REPLAY_API_KEY"]!);
      //   const endpoint = await client.getSessionEndpoint();

      console.log(`Session started with id ${sessionId}`);

      // Get the actual port that was assigned
      const address = wss.address();
      if (typeof address === "object" && address !== null) {
        // Send the port number and session id back to the parent process
        process.send?.({
          type: "server-started",
          sessionId: sessionId,
          pid: process.pid,
          port: address.port,
        });
      }
    } catch (e) {
      console.error(`Error: ${e}`);
    }
  });

  wss.on("error", error => {
    process.send?.({
      type: "error",
      error: error.message,
    });
  });

  // Basic WebSocket server implementation
  wss.on("connection", ws => {
    ws.on("message", async (req: string) => await handleRequest(ws, req));
  });

  // Prevent the process from exiting
  process.on("disconnect", () => {
    // Parent process disconnected, but we keep running
    console.log("Parent process disconnected, server continuing...");
  });

  // Handle signals properly
  process.on("SIGTERM", () => {
    console.log("Received SIGTERM, closing server...");
    wss.close(() => {
      process.exit(0);
    });
  });

  const signals = ["SIGINT", "SIGHUP"];
  signals.forEach(signal => {
    process.on(signal, () => {
      console.log(`Received ${signal}, but keeping server alive`);
    });
  });

  // Keep the event loop alive
  setInterval(() => {
    // Heartbeat to keep process alive
  }, 60000);

  // Prevent uncaught exceptions from killing the server
  process.on("uncaughtException", err => {
    console.error("Uncaught Exception:", err);
  });

  process.on("exit", code => {
    console.log(`Server process exiting with code ${code}`);
  });

  console.log("Websocket server process started");
}

initializeLogging();

console.log("Starting server process using command", process.argv.join(" "));
const recordingId = process.argv[2];

startServer(recordingId);
