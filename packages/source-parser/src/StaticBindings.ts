import { CodeAtLocation } from "./types";

export type StaticBinding = {
  /**
   * Binding kind, based on Babel: var, let, const, param etc.
   * @see https://github.com/babel/babel/blob/main/packages/babel-traverse/src/scope/binding.ts#L5
   */
  kind: string;

  /**
   * Declaration.
   */
  declaration?: CodeAtLocation;

  /**
   * All writes to this binding (if it has any).
   */
  writes?: CodeAtLocation[];
};
