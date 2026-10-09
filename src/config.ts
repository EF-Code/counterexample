import { z } from "zod";
import { modelSchema } from "./promise.ts";

export const envSchema = z.object({
  NEBIUS_API_KEY: z.string().trim().optional(),
  NEBIUS_MODEL: modelSchema.default("nvidia/nemotron-3-super-120b-a12b"),
  ENABLE_LIVE_AI: z.enum(["true", "false"]).default("false"),
  ENABLE_REPAIR_SANDBOX: z.enum(["true", "false"]).default("false"),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
});

export type AppConfig = z.infer<typeof envSchema>;
