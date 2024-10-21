import { WebSocket } from "ws";

type PingRequest = {
  type: "ping";
};

type PongResponse = {
  type: "pong";
};

type Request = PingRequest;
type Response = PongResponse;

function sendResponse(ws: WebSocket, response: Response) {
  console.log(`Sending Response: ${JSON.stringify(response)}`);
  ws.send(JSON.stringify(response));
}

export async function handleRequest(ws: WebSocket, message: string): Promise<void> {
  console.log(`Received Request: ${message}`);

  const msg: Request = JSON.parse(message);

  switch (msg.type) {
    case "ping":
      sendResponse(ws, { type: "pong" });
      break;
    default:
      console.error(`Unknown message type: ${msg.type}`);
      break;
  }
}
