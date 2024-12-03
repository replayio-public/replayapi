/* Copyright 2020-2024 Record Replay Inc. */
import { z } from "zod";
import { AnalysisDefaultSpecSchema, DependencyChainStep, DependencyGraphMode } from "../dependencyGraphShared";

export interface AnalyzeDependenciesResult {
  dependencies: DependencyChainStep[];
}

export interface AnalyzeDependenciesOptions {
  server: string;
  diskCacheDirPath?: string;
  apiKey?: string;
}

export const AnalyzeDependenciesSpecSchema = AnalysisDefaultSpecSchema.extend({
  point: z.string(),
  mode: z
    .enum([DependencyGraphMode.ReactInstanceRenders, DependencyGraphMode.ReactOwnerRenders])
    .optional(),
}).strict();
export type AnalyzeDependenciesSpec = z.infer<typeof AnalyzeDependenciesSpecSchema>;
