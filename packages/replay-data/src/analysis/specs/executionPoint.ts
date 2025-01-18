/* Copyright 2020-2024 Record Replay Inc. */

import { ExecutionPoint } from "@replayio/protocol";
import { z } from "zod";

import { DependencyEventNode } from "../../recordingData/types";
import { AnalysisDefaultSpecSchema, URLLocation } from "../dependencyGraphShared";

export const ExecutionPointSpecSchema = AnalysisDefaultSpecSchema.extend({
  // Point whose execution data is being described.
  point: z.optional(z.string()),

  // Depth of associated points to recursively describe.
  depth: z.optional(z.number()),

  /** Value expression to compute dataflow for. */
  value: z.optional(z.string()),
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

  associatedDataflow?: string;
}

export interface ExecutionDataPoint {
  // Associated point.
  point: ExecutionPoint;

  // Location in the recording being described.
  location: URLLocationWithSource;

  // Entries describing the point.
  entries: ExecutionDataEntry[];
}

// A location within a recording and associated source contents.
export interface URLLocationWithSource extends URLLocation {
  // Text from the application source indicating the location.
  source: string;
}

export interface ExecutionDataAnalysisResult {
  // Points which were described.
  points: ExecutionDataPoint[];

  // The best entry point, as determined by the analysis.
  point?: ExecutionPoint;

  // Any comment text associated with the point.
  commentText?: string;

  // If the comment is on a React component, the name of the component.
  reactComponentName?: string;

  firstReactRenderError?: DependencyEventNode & {
    message: string;
  };

  // If the point is for a console error, the error text.
  consoleError?: string;
}
