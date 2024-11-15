/* Copyright 2020-2024 Record Replay Inc. */
/**
 * @file This file contains a copy-and-paste of some of tree-sitter's internal types
 * which, for some reason, are not exported.
 */

export type BaseNode = {
  type: string;
  named: boolean;
};

export type ChildNode = {
  multiple: boolean;
  required: boolean;
  types: BaseNode[];
};

export type NodeInfo =
  | (BaseNode & {
      subtypes: BaseNode[];
    })
  | (BaseNode & {
      fields: { [name: string]: ChildNode };
      children: ChildNode[];
    });

export type Language = {
  name: string;
  language: unknown;
  nodeTypeInfo: NodeInfo[];
};