import { WebSocket } from "ws";

export const ShutdownRequestType = "die";

export type ShutdownRequest = {
  type: typeof ShutdownRequestType;
};

export function handleRequest(_ws: WebSocket, _req: ShutdownRequest): void {
    // don't bother sending a response, just exit
    process.exit(0);
}