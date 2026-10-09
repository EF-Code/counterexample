import { z } from "zod";
import { actionSchema } from "./domain.ts";

const traceSchema = z
  .object({
    step: z.number().int().positive(),
    action: actionSchema,
    outcome: z.enum(["committed", "deduplicated", "already_confirmed", "restarted", "observed"]),
    response: z.enum(["acknowledged", "timed_out", "none"]),
    successfulCharges: z.number().int().nonnegative(),
    chargedCents: z.number().int().nonnegative(),
  })
  .readonly();

export const billingReplaySchema = z
  .object({
    property: z.literal("at_most_one_charge_per_intent"),
    holds: z.boolean(),
    successfulCharges: z.number().int().nonnegative(),
    chargedCents: z.number().int().nonnegative(),
    trace: z.array(traceSchema).max(20).readonly(),
  })
  .readonly();

export const adapterRequestSchema = z
  .strictObject({
    adapterPath: z.string().min(1),
    actions: z.array(actionSchema).min(1).max(20).readonly(),
  })
  .readonly();

export const adapterReportSchema = z
  .strictObject({
    execution: z.literal("trusted_local_code"),
    property: z.literal("at_most_one_charge_per_intent"),
    originalActions: z.array(actionSchema).max(20).readonly(),
    reducedActions: z.array(actionSchema).max(20).readonly(),
    originalReplay: billingReplaySchema,
    reducedReplay: billingReplaySchema,
  })
  .readonly();
export type AdapterRequest = z.infer<typeof adapterRequestSchema>;
export type AdapterReport = z.infer<typeof adapterReportSchema>;

export const workerErrorSchema = z.enum([
  "adapter_failed",
  "adapter_contract_invalid",
  "provider_call_budget_exceeded",
  "provider_call_outside_attempt",
  "invalid_idempotency_key",
  "unsupported_action",
]);
export const workerReplySchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("ok"), report: adapterReportSchema }).readonly(),
  z.strictObject({ status: z.literal("error"), code: workerErrorSchema }).readonly(),
]);
