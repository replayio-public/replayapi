import { ExecutionPoint } from "@replayio/protocol";
import { Command, Option } from "commander";

export interface RecordingOption {
  recordingId: string;
}

export function requiresRecording(command: Command): void {
  const option = new Option("-r, --recordingId <recordingId>", "Recording ID")
    .env("REPLAY_RECORDING")
    .makeOptionMandatory(true);
  command.addOption(option);
}

export interface APIKeyOption {
  apiKey: string;
}

export function requiresAPIKey(command: Command): void {
  const option = new Option("-k, --api-key <API_KEY>", "API KEY")
    .env("REPLAY_API_KEY")
    .makeOptionMandatory(true);

  command.addOption(option);
}

export interface SessionOption {
  session: string;
}

export function requiresSession(command: Command): void {
  const option = new Option("-s, --session <SESSION_ID>", "Session ID").makeOptionMandatory(true);

  command.addOption(option);
}

export interface PointOption {
  point: ExecutionPoint;
}

export function requiresPoint(command: Command): void {
  const option = new Option("-p, --point <point>", "Execution point within a recording.")
    .argParser(
      // Strip `n` if given (since BigInt strings must not have an `n` in it).
      p => (p?.endsWith("n") ? p.slice(0, -1) : p)
    )
    .makeOptionMandatory(true);
  command.addOption(option);
}
