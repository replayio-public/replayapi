import { WebSocket } from "ws";

import { sendResponse } from "./index";

export const PingRequestType = "ping";

export type PingRequest = {
  type: typeof PingRequestType;
};

export type PingResponse = {
  type: "pong";
};

export function handleRequest(ws: WebSocket, _req: PingRequest): void {
  sendResponse(ws, { type: "pong" });
}
