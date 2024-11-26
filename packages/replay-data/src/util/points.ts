/* Copyright 2020-2024 Record Replay Inc. */

/**
 * @file Copy-and-pasted from "$REPLAY_DIR/backend/src/shared/point.ts".
 */

import { assert } from "../util/assert";

export const InvalidCheckpointId = 0;
export const FirstCheckpointId = 1;

export const FirstCheckpointExecutionPoint = {
  checkpoint: FirstCheckpointId,
  progress: 0,
};

export type ExecutionPointInfo =
  | FrameExecutionPoint
  | CheckpointExecutionPoint
  | BookmarkExecutionPoint
  | DebugProgressExecutionPoint;

// An execution point with an execution position.
export interface FrameExecutionPoint {
  readonly checkpoint: number;
  readonly progress: number;
  readonly position: ExecutionPosition;
  readonly bookmark?: undefined;
}

// An execution point positioned exactly at a checkpoint.
export interface CheckpointExecutionPoint {
  readonly checkpoint: number;
  readonly progress: number;
  readonly position?: undefined;
  readonly bookmark?: undefined;
}

// An execution point positioned exactly at a bookmark.
export interface BookmarkExecutionPoint {
  readonly checkpoint: number;
  readonly progress: number;
  readonly position?: undefined;
  readonly bookmark: number;
}

// An execution point positioned exactly at a progress value.
export interface DebugProgressExecutionPoint {
  readonly checkpoint: number;
  readonly debugProgress: number;

  // NOTE: we don't have "progress" but we don't want to change production for this.
  readonly progress: number;
  readonly position?: undefined;
  readonly bookmark?: undefined;
}

export type ExecutionPosition = FrameBoundaryPosition | FrameStepPosition;

export interface FrameBoundaryPosition {
  readonly kind: "EnterFrame" | "OnPop" | "OnUnwind";
  readonly functionId: string;
  readonly frameIndex: number;
  readonly offset?: undefined;
}

export interface FrameStepPosition {
  readonly kind: "OnStep";
  readonly functionId: string;
  readonly frameIndex: number;
  // Step positions have an explicit function bytecode offset.
  readonly offset: number;
}

// A frame position without a frameIndex is just an abstract representation of
// a location within a function. These are used for querying hits.
export interface BreakPosition {
  readonly kind: "Break";
  readonly functionId: string;
  readonly frameIndex?: undefined;
  readonly offset: number;
}

// Hit positions are position types that can be used to query hits.
export type HitPosition = BreakPosition | FrameStepPosition;

// Convert an execution point to a BigInt, such that points preceding each other
// are converted to bigints that are less than each other. Any changes to this
// function need to be synchronized with BigIntToPoint below, and with
// CurrentExecutionPoint in Navigate.cpp
export function pointToBigInt(point: ExecutionPointInfo): BigInt {
  let rv = BigInt(0);
  let shift = 0;

  if (point.position) {
    addValue(point.position.offset || 0, 32);
    switch (point.position.kind) {
      case "EnterFrame":
        addValue(0, 3);
        break;
      case "OnStep":
        addValue(1, 3);
        break;
      // NOTE: In the past, "2" here indicated an "OnThrow" step type.
      case "OnPop":
        addValue(3, 3);
        break;
      case "OnUnwind":
        addValue(4, 3);
        break;
      default:
        throw new Error(`Unkonwn point.position.kind: ${JSON.stringify(point)}`);
    }
    // Deeper frames predate shallower frames with the same progress counter.
    assert(point.position.frameIndex !== undefined, "Point should have a frameIndex", {
      point,
    });
    addValue((1 << 24) - 1 - point.position.frameIndex, 24);
    // Points with positions are later than points with no position.
    addValue(1, 1);
  } else {
    addValue(point.bookmark || 0, 32);
    addValue(0, 3 + 24 + 1);
  }

  addValue(point.progress, 48);

  // Subtract here so that the first point in the recording is 0 as reflected
  // in the protocol definition.
  addValue(point.checkpoint - FirstCheckpointId, 32);

  return rv;

  function addValue(v: number, nbits: number) {
    rv |= BigInt(v) << BigInt(shift);
    shift += nbits;
  }
}

// Convert a point BigInt back to the original point, except for the function
// (which is an arbitrary string and can't be embedded in the point).
export function BigIntToPoint(n: bigint): ExecutionPointInfo {
  const offset = readValue(32);
  const kindValue = readValue(3);
  const indexValue = readValue(24);
  const hasPosition = readValue(1);
  const progress = readValue(48);
  const checkpoint = readValue(32) + FirstCheckpointId;

  if (!hasPosition) {
    if (offset) {
      return { checkpoint, progress, bookmark: offset };
    }
    return { checkpoint, progress };
  }

  let kind!: "EnterFrame" | "OnStep" | "OnPop" | "OnUnwind";
  switch (kindValue) {
    case 0:
      kind = "EnterFrame";
      break;
    case 1:
      kind = "OnStep";
      break;
    case 2:
      throw new Error(`Unexpected point of kind OnThrow: ${n.toString() + "n"}`);
    case 3:
      kind = "OnPop";
      break;
    case 4:
      kind = "OnUnwind";
      break;
  }

  const frameIndex = (1 << 24) - 1 - indexValue;
  return {
    checkpoint,
    progress,
    position: { kind, offset, frameIndex },
  } as ExecutionPointInfo;

  function readValue(nbits: number) {
    const mask = (BigInt(1) << BigInt(nbits)) - BigInt(1);
    const rv = Number(n & mask);
    n = n >> BigInt(nbits);
    return rv;
  }
}
