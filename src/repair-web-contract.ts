import { z } from "zod";
import { repairRecordSchema, verificationSchema } from "./repair-contract.ts";

export const jobIdSchema = z.string().uuid().brand<"RepairJobId">();
export type RepairJobId = z.infer<typeof jobIdSchema>;
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const repairSessionSchema = z
  .object({
    enabled: z.boolean(),
    liveAvailable: z.boolean(),
    token: hashSchema.nullable(),
    limit: z.literal(5),
  })
  .readonly();
export type RepairSession = z.infer<typeof repairSessionSchema>;
export const webProposalRequestSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("reference") }).readonly(),
  z.strictObject({ mode: z.literal("nebius"), consentToSendSource: z.literal(true) }).readonly(),
]);
export type WebProposalRequest = z.infer<typeof webProposalRequestSchema>;
export const webApprovalSchema = z
  .strictObject({
    jobId: jobIdSchema,
    proposalHash: hashSchema,
    approved: z.literal(true),
  })
  .readonly();

export const proposalViewSchema = z
  .object({
    jobId: jobIdSchema,
    proposalHash: hashSchema,
    record: repairRecordSchema,
    before: z.string().max(65536),
    after: z.string().max(65536),
    diff: z.string().max(150000),
  })
  .readonly();
export type ProposalView = z.infer<typeof proposalViewSchema>;

export const verifiedViewSchema = z
  .object({
    accepted: z.boolean(),
    regressionPassed: z.boolean(),
    imageId: z.string(),
    verification: verificationSchema,
    source: z.enum(["reference", "nebius"]),
    originalFilesModified: z.literal(false),
    scope: z.literal("single_purchase_fixture_bounded_verification"),
  })
  .readonly();
export type VerifiedView = z.infer<typeof verifiedViewSchema>;
export const artifactSchema = z.enum([
  "proposal.json",
  "change.diff",
  "verification.json",
  "repair-bundle.json",
]);
export type RepairArtifact = z.infer<typeof artifactSchema>;

export class RepairWebError extends Error {
  readonly code: string;
  readonly status: 403 | 404 | 409 | 429 | 500 | 502 | 503;
  constructor(code: string, status: RepairWebError["status"]) {
    super(code);
    this.name = "RepairWebError";
    this.code = code;
    this.status = status;
  }
}
