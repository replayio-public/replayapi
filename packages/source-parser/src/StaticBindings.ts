import { CodeAtLocation } from "@replayio/data/src/recordingData/types";

export type StaticBinding = {
  /**
   * Binding kind, based on Babel terminology.
   * @see https://github.com/babel/babel/blob/main/packages/babel-traverse/src/scope/binding.ts#L5
   */
  kind: string;

  location: CodeAtLocation;
};
