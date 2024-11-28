/* Copyright 2020-2024 Record Replay Inc. */

import { z } from "zod";

import { AnalysisDefaultSpecSchema, AnalysisType } from "./dependencyGraphShared";
import { AnalyzeDependenciesSpecSchema } from "./specs/analyzeDependencies";
import { ExecutionPointSpecSchema } from "./specs/executionPoint";
import { RerecordAnalysisSpecSchema } from "./specs/rerecording";

function inputSchema<
  T extends AnalysisType,
  Spec extends z.ZodObject<(typeof AnalysisDefaultSpecSchema)["shape"], "strict">,
>(type: T, spec: Spec) {
  return z
    .object({
      analysisType: z.literal(type),
      spec,
    })
    .strict();
}

export const AnalysisInputSchema = z.discriminatedUnion("analysisType", [
  inputSchema(AnalysisType.Performance, AnalysisDefaultSpecSchema),
  inputSchema(AnalysisType.RootCause, AnalysisDefaultSpecSchema),
  inputSchema(AnalysisType.Dependency, AnalyzeDependenciesSpecSchema),
  inputSchema(AnalysisType.ReactStateChanges, AnalysisDefaultSpecSchema),
  inputSchema(AnalysisType.RerecordCompare, RerecordAnalysisSpecSchema),
  inputSchema(AnalysisType.ExecutionPoint, ExecutionPointSpecSchema),
]);
export type AnalysisInput<
  T extends z.infer<typeof AnalysisInputSchema>["analysisType"] = z.infer<
    typeof AnalysisInputSchema
  >["analysisType"],
> = Extract<z.infer<typeof AnalysisInputSchema>, { analysisType: T }>;
