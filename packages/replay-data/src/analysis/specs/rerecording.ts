/* Copyright 2020-2024 Record Replay Inc. */

import { z } from "zod";

import { WebSocketAnnotationContents } from "./caches";
import { AnalysisDefaultSpecSchema } from "../dependency-graph-shared";
// Network resource accessed by a recording.
export interface RerecordResource {
  url: string;
  requestBodyBase64: string;
  responseBodyBase64: string;
  responseStatus: number;
  responseHeaders: Record<string, string>;
}

export interface RerecordWebSocket {
  socketId: number;
  annotations: WebSocketAnnotationContents[];
}

export interface RerecordInteraction {
  kind: "click";

  // Elapsed time when the interaction occurred.
  time: number;

  // Selector of the element clicked.
  selector: string;

  // Dimensions of the element clicked.
  width: number;
  height: number;

  // Position within the element which was clicked.
  x: number;
  y: number;
}

export interface IndexedDBAccess {
  kind: "get" | "put" | "add";
  key?: any;
  item?: any;
  storeName: string;
  databaseName: string;
  databaseVersion: number;
}

export interface LocalStorageAccess {
  kind: "get" | "set";
  key: string;
  value?: string;
}

export interface RerecordData {
  // Contents of window.location.href.
  locationHref: string;

  // URL of the main document.
  documentUrl: string;

  // All resources accessed.
  resources: RerecordResource[];

  // All WebSocket connections made.
  websockets: RerecordWebSocket[];

  // All user interactions made.
  interactions: RerecordInteraction[];

  // All indexedDB accesses made.
  indexedDBAccesses: IndexedDBAccess[];

  // All localStorage accesses made.
  localStorageAccesses: LocalStorageAccess[];
}

// Arguments taken by different kinds of analyses.
export const RerecordAnalysisSpecSchema = AnalysisDefaultSpecSchema.extend({
  apiKey: z.string(),
  rerecordServerURL: z.string(),
}).strict();
export type RerecordAnalysisSpec = z.infer<typeof RerecordAnalysisSpecSchema>;
