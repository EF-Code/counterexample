import { z } from "zod";
import { billingReplaySchema } from "./adapter-contract.ts";
import { modelSchema } from "./promise.ts";

export const proposalSchema = z
  .strictObject({
    status: z.literal("proposal"),
    operation: z.literal("replace_charge_key"),
    file: z.literal("service.ts"),
    replacementKey: z
      .string()
      .regex(/^purchase:[A-Za-z0-9_-]{1,64}$/)
      .brand<"PurchaseKey">(),
    rationale: z.string().min(1).max(2000),
  })
  .readonly();
export const repairResponseSchema = z.discriminatedUnion("status", [
  proposalSchema,
  z.strictObject({ status: z.literal("abstain"), reason: z.string().min(1).max(2000) }).readonly(),
]);
export type RepairProposal = z.infer<typeof proposalSchema>;

export const verificationSchema = z
  .strictObject({
    captured: billingReplaySchema,
    capturedRepeatMatches: z.boolean(),
    schedulesChecked: z.literal(780),
    violationsFound: z.number().int().min(0).max(780),
    nonExercisedPaymentSchedules: z.number().int().min(0).max(780),
  })
  .readonly();
export type Verification = z.infer<typeof verificationSchema>;

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const repairRecordSchema = z
  .strictObject({
    formatVersion: z.literal(1),
    source: z.enum(["reference", "nebius"]),
    proposal: proposalSchema,
    imageId: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    hashes: z
      .strictObject({
        service: hashSchema,
        adapter: hashSchema,
        runtime: hashSchema,
        verifier: hashSchema,
      })
      .readonly(),
    baseline: verificationSchema,
    inference: z
      .object({
        requestedModel: modelSchema,
        responseModel: z.string(),
        usage: z
          .object({
            prompt_tokens: z.number().int(),
            completion_tokens: z.number().int(),
            total_tokens: z.number().int(),
          })
          .nullable(),
      })
      .readonly()
      .nullable(),
  })
  .readonly();
export type RepairRecord = z.infer<typeof repairRecordSchema>;

export class RepairError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "RepairError";
    this.code = code;
  }
}

export function applyRepair(source: string, proposal: RepairProposal): string {
  const anchor = "provider.charge(null)";
  if (source.split(anchor).length !== 2) throw new RepairError("unsupported_repair_source");
  return source.replace(anchor, `provider.charge(${JSON.stringify(proposal.replacementKey)})`);
}

export function candidatePasses(result: Verification): boolean {
  return (
    result.captured.holds &&
    result.captured.successfulCharges === 1 &&
    result.capturedRepeatMatches &&
    result.schedulesChecked === 780 &&
    result.violationsFound === 0 &&
    result.nonExercisedPaymentSchedules === 0
  );
}
