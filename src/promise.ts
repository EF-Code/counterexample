import { z } from "zod";

export const interpretationSchema = z.discriminatedUnion("status", [
  z
    .strictObject({
      status: z.literal("supported"),
      property: z.literal("at_most_one_charge_per_intent"),
      scope: z.literal("single_purchase_intent"),
      explanation: z.string().min(1).max(2000),
    })
    .readonly(),
  z
    .strictObject({
      status: z.literal("unsupported"),
      reason: z.string().min(1).max(2000),
    })
    .readonly(),
]);

export type Interpretation = z.infer<typeof interpretationSchema>;
export const interpretationRequestSchema = z
  .strictObject({
    promise: z.string().trim().min(10).max(2000),
    consentToSend: z.literal(true),
  })
  .readonly();

export const modelSchema = z.enum([
  "nvidia/nemotron-3-super-120b-a12b",
  "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
  "nvidia/Nemotron-3_5-Lightning",
  "nvidia/Nemotron-3-Ultra-550b-a55b",
]);
export type NvidiaModel = z.infer<typeof modelSchema>;

export type InferenceResult = {
  readonly interpretation: Interpretation;
  readonly requestedModel: NvidiaModel;
  readonly responseModel: string;
  readonly reviewRequired: true;
  readonly usage: {
    readonly prompt_tokens: number;
    readonly completion_tokens: number;
    readonly total_tokens: number;
  } | null;
};
