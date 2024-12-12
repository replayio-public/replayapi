import { ExecutionPoint } from "@replayio/protocol";
import { Command, Option } from "commander";

export interface RecordingOption {
  recording: string;
}

export function requiresRecording(command: Command): void {
  const option = new Option("-r, --recording <RECORDING>", "Recording ID or URL")
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
  const option = new Option("-p, --point <point>", "Execution point within a recording.");
  command.addOption(option);
}
