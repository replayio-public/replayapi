import { fork } from "child_process";
import fs from "fs";
import path from "path";

import { SessionId } from "@replayio/protocol";
import { Deferred, defer } from "protocol/utils";
import { WebSocket } from "ws";

import { type Request, type Response } from "./requests";

export type ServerInfo = {
  sessionId: SessionId;
  recordingId: string;
  pid: number;
  port: number;
  alive?: true;
};

// sessions are given a separate process to run in.  to discover the port for a
// given session, the filesystem is used.  Symlinks are created in SESSION_DIR
// that have the form:
//
//   <sessionId> -> recordingId:<serverPid>:<serverPort>
//
// where <sessionId> is the session id, recordingId is the recording id, and
// <port> is the port the server for this session is running on.

const SESSION_DIR = "/tmp/replay-sessions";

function ensureDirExists(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function registerServer(sessionId: string, recordingId: string, pid: number, port: number) {
  const linkPath = path.join(SESSION_DIR, sessionId);
  const target = `${recordingId}:${pid}:${port}`;
  fs.symlinkSync(target, linkPath);
}

function unregisterServer(sessionId: string) {
  const linkPath = path.join(SESSION_DIR, sessionId);
  fs.unlinkSync(linkPath);
}

function parseSymlinkTarget(sessionId: SessionId, target: string): ServerInfo {
  // Parse the target which should be in format "recordingId:serverPid:serverPort"
  const [recordingId, pidStr, portStr] = target.split(":");

  // Validate the format
  if (!recordingId || !pidStr || !portStr) {
    throw new Error(`Invalid symlink format for session ${sessionId}: ${target}`);
  }

  const pid = parseInt(pidStr, 10);
  if (isNaN(pid)) {
    throw new Error(`Invalid port number for session ${sessionId}: ${portStr}`);
  }

  const port = parseInt(portStr, 10);
  if (isNaN(port)) {
    throw new Error(`Invalid port number for session ${sessionId}: ${portStr}`);
  }

  return {
    sessionId,
    recordingId,
    pid,
    port,
  };
}

function getServerInfos(): ServerInfo[] {
  // Ensure the directory exists
  ensureDirExists(SESSION_DIR);

  // Read all entries in the directory
  const entries = fs.readdirSync(SESSION_DIR, { withFileTypes: true });

  // Filter for symlinks and process each one
  return entries
    .filter(entry => entry.isSymbolicLink())
    .map(entry => {
      const sessionId = entry.name;

      // Read the symlink target
      const linkPath = path.join(SESSION_DIR, entry.name);
      const target = fs.readlinkSync(linkPath);

      return parseSymlinkTarget(sessionId, target);
    });
}

function pingServer(serverInfo: ServerInfo): Promise<true> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${serverInfo.port}`);
    ws.on("open", () => {
      // send a PingRequest
      ws.send(JSON.stringify({ type: "ping" }));
    });
    ws.on("message", (message: string) => {
      const msg = JSON.parse(message.toString());
      if (msg.type === "pong") {
        resolve(true);
      } else {
        reject(new Error(`Unexpected message: ${message}`));
      }
      ws.close();
    });
    ws.on("error", err => {
      reject(err);
    });
  });
}

export async function listServers(pingServers?: boolean): Promise<ServerInfo[]> {
  // walk the directory and read the symlinks
  const serverInfos = getServerInfos();

  if (!pingServers) {
    return serverInfos;
  }

  for (const serverInfo of serverInfos) {
    // TODO: check if the server is still alive by trying to connect to it/ping it
    try {
      serverInfo.alive = await pingServer(serverInfo);
    } catch (e) {
      console.log(`Error pinging at port ${serverInfo.port}`, e);
    }

    // if it's not, remove the symlink
    // if (!serverInfo.alive) {
    //   unregisterServer(serverInfo.sessionId);
    // }
  }
  return serverInfos;
}

export async function pruneServers(): Promise<void> {
  // list servers (and ping them)
  const serverInfos = await listServers(true);

  // unregister any that are not alive
  for (const serverInfo of serverInfos) {
    if (!serverInfo.alive) {
      unregisterServer(serverInfo.sessionId);
    }
  }
}

type ErrorMessage = {
  type: "error";
  error: string;
};

type ServerStartedMessage = {
  type: "server-started";
  sessionId: string;
  port: number;
  pid: number;
};

type Message = ErrorMessage | ServerStartedMessage;

export function startServer(apiKey: string, recordingId: string): Deferred<ServerInfo> {
  const deferred = defer<ServerInfo>();

  const child = fork(path.join(__dirname, "server-process.ts"), [recordingId], {
    env: {
      ...process.env,
      REPLAY_API_KEY: apiKey
    },
    // Detach the child process so it can run independently
    detached: true,
    // Ignore parent's stdio after getting the port
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });

  // Set a timeout for the initial startup only
  const timeoutMillis = 5_000;
  const timeout = setTimeout(() => {
    child.kill();
    deferred.reject(new Error(`Server start timeout (${timeoutMillis / 1000}s)`));
  }, timeoutMillis);

  // Listen for the port number from the child process
  child.on("message", (message: Message) => {
    if (message.type === "server-started") {
      // Clean up timeout on success
      clearTimeout(timeout);

      // Unref the child to allow the parent to exit independently
      child.unref();
      // Disconnect IPC to allow child to run independently
      child.disconnect();

      registerServer(message.sessionId, recordingId, message.pid, message.port);
      deferred.resolve({
        sessionId: message.sessionId,
        recordingId,
        pid: message.pid,
        port: message.port,
        alive: true,
      });
    } else if (message.type === "error") {
      child.kill();
      deferred.reject(new Error(message.error));
    }
  });

  // Handle child process errors during startup
  child.on("error", err => {
    deferred.reject(new Error(`Failed to start server process: ${err.message}`));
  });

  return deferred;
}

export async function endServer(sessionId: string): Promise<void> {
  const serverInfos = getServerInfos();
  const serverInfo = serverInfos.find(info => info.sessionId === sessionId);
  if (!serverInfo) {
    throw new Error(`No session found for id ${sessionId}`);
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${serverInfo.port}`);
    ws.on("open", () => {
      // send a ShutdownRequest
      ws.send(JSON.stringify({ type: "die" }));
      // remove the symlink
      unregisterServer(sessionId);

      resolve();
    });
    ws.on("message", (message: string) => {
      reject(new Error(`Unexpected message: ${message}`));
      ws.close();
    });
    ws.on("error", err => {
      reject(err);
    });
  });
}

export function sendRequestToServer<ResponseT extends Response>(sessionId: string, request: Request): Promise<ResponseT> {
  const serverInfos = getServerInfos();
  const serverInfo = serverInfos.find(info => info.sessionId === sessionId);
  if (!serverInfo) {
    throw new Error(`No session found for id ${sessionId}`);
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${serverInfo.port}`);
    ws.on("open", () => {
      ws.send(JSON.stringify(request));
    });
    ws.on("message", (message: string) => {
      resolve(JSON.parse(message));
      ws.close();
    });
    ws.on("error", err => {
      reject(err);
    });
  });
}