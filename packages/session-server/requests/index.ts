import { WebSocket } from "ws";

import {
  PingRequest,
  PingRequestType,
  PingResponse,
  handleRequest as handlePingRequest,
} from "./ping";
import {
  ShutdownRequest,
  ShutdownRequestType,
  handleRequest as handleShutdownRequest,
} from "./shutdown";

type Request = PingRequest | ShutdownRequest;
type Response = PingResponse;

export function sendResponse(ws: WebSocket, response: Response): void {
  console.log(`Sending Response: ${JSON.stringify(response)}`);
  ws.send(JSON.stringify(response));
}

export async function handleRequest(ws: WebSocket, message: string): Promise<void> {
  console.log(`Received Request: ${message}`);

  const msg: Request = JSON.parse(message);

  switch (msg.type) {
    case PingRequestType:
      handlePingRequest(ws, msg);
      break;
    case ShutdownRequestType:
      handleShutdownRequest(ws, msg);
      break;
    default:
      console.error(`Unknown message type`);
      break;
  }
}
