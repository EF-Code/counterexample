import { z } from "zod";
import { actionSchema, workflowSchema } from "../src/domain.ts";
import { interpretationSchema, modelSchema } from "../src/promise.ts";

const traceEntrySchema = z
  .object({
    step: z.number().int().positive(),
    action: actionSchema,
    outcome: z.enum(["committed", "deduplicated", "already_confirmed", "restarted", "observed"]),
    response: z.enum(["acknowledged", "timed_out", "none"]),
    successfulCharges: z.number().int().nonnegative(),
    chargedCents: z.number().int().nonnegative(),
  })
  .readonly();

export const replaySchema = z
  .object({
    workflow: workflowSchema,
    property: z.literal("at_most_one_charge_per_intent"),
    holds: z.boolean(),
    successfulCharges: z.number().int().nonnegative(),
    chargedCents: z.number().int().nonnegative(),
    trace: z.array(traceEntrySchema).max(20).readonly(),
  })
  .readonly();

const searchSchema = z
  .object({
    maxDepth: z.number().int().min(1).max(4),
    schedulesChecked: z.number().int().nonnegative(),
    violationsFound: z.number().int().nonnegative(),
  })
  .readonly();

export const evidenceSchema = z
  .object({
    formatVersion: z.literal(1),
    provenance: z.literal("deterministic_fixture"),
    property: z.literal("at_most_one_charge_per_intent"),
    original: z.array(actionSchema).max(20).readonly(),
    reduced: z.array(actionSchema).max(20).readonly(),
    originalReplay: replaySchema,
    before: replaySchema,
    referenceControl: replaySchema,
    exploration: z.object({ vulnerable: searchSchema, idempotent: searchSchema }).readonly(),
    limitations: z.array(z.string()).readonly(),
  })
  .readonly();
export type Evidence = z.infer<typeof evidenceSchema>;

export const inferenceSchema = z
  .object({
    interpretation: interpretationSchema,
    requestedModel: modelSchema,
    responseModel: z.string(),
    reviewRequired: z.literal(true),
    usage: z
      .object({
        prompt_tokens: z.number().int().nonnegative(),
        completion_tokens: z.number().int().nonnegative(),
        total_tokens: z.number().int().nonnegative(),
      })
      .readonly()
      .nullable(),
  })
  .readonly();

export const healthSchema = z
  .object({
    status: z.literal("ok"),
    liveAiEnabled: z.boolean(),
    apiKeyConfigured: z.boolean(),
    model: modelSchema,
  })
  .readonly();
export type Health = z.infer<typeof healthSchema>;
