import { z } from "zod";

export const actionSchema = z.enum(["charge", "charge_timeout", "retry", "restart", "observe"]);
export const workflowSchema = z.enum(["vulnerable", "idempotent"]);
export const scenarioSchema = z
  .strictObject({
    workflow: workflowSchema,
    actions: z.array(actionSchema).max(20).readonly(),
  })
  .readonly();

export type Action = z.infer<typeof actionSchema>;
export type Workflow = z.infer<typeof workflowSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
export const intentIdSchema = z.string().min(1).brand<"IntentId">();
export type IntentId = z.infer<typeof intentIdSchema>;

export type TraceEntry = {
  readonly step: number;
  readonly action: Action;
  readonly outcome: "committed" | "deduplicated" | "already_confirmed" | "restarted" | "observed";
  readonly response: "acknowledged" | "timed_out" | "none";
  readonly successfulCharges: number;
  readonly chargedCents: number;
};

export type Replay = {
  readonly workflow: Workflow;
  readonly property: "at_most_one_charge_per_intent";
  readonly holds: boolean;
  readonly successfulCharges: number;
  readonly chargedCents: number;
  readonly trace: readonly TraceEntry[];
};

export function assertNever(value: never): never {
  throw new UnreachableVariantError(value);
}

class UnreachableVariantError extends Error {
  constructor(value: never) {
    super(`Unreachable variant: ${String(value)}`);
    this.name = "UnreachableVariantError";
  }
}
