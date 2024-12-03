/* Copyright 2020-2024 Record Replay Inc. */

import { z } from "zod";
import { AnalysisDefaultSpecSchema, URLLocation } from "../dependencyGraphShared";
import { ExecutionPoint } from "@replayio/protocol";

export const ExecutionPointSpecSchema = AnalysisDefaultSpecSchema.extend({
  // Point whose execution data is being described.
  point: z.string(),

  // Depth of associated points to recursively describe.
  depth: z.optional(z.number()),
}).strict();
export type ExecutionDataAnalysisSpec = z.infer<typeof ExecutionPointSpecSchema>;

// A location within a recording and associated source contents.
export interface URLLocationWithSource extends URLLocation {
  // Text from the application source indicating the location.
  source: string;
}

export interface ExecutionDataEntry {
  // Value from the application source which is being described.
  value?: string;

  // Description of the contents of the value. If |value| is omitted
  // this describes a control dependency for the location.
  contents: string;

  // Any associated execution point.
  associatedPoint?: ExecutionPoint;

  // Location in the recording of the associated execution point.
  associatedLocation?: URLLocationWithSource;
}

export interface ExecutionDataPoint {
  // Associated point.
  point: ExecutionPoint;

  // Location in the recording being described.
  location: URLLocationWithSource;

  // Entries describing the point.
  entries: ExecutionDataEntry[];
}

export interface ExecutionDataAnalysisResult {
  // Points which were described.
  points: ExecutionDataPoint[];
}
