import { z } from "zod";
import { envSchema } from "./config.ts";
import { quotaConfigSchema } from "./hosted-quota.ts";

const originSchema = z
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === "" &&
      url.username === "" &&
      url.password === "" &&
      /^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(url.hostname)
    );
  })
  .transform((value) => new URL(value).origin);
const hostSchema = z.string().regex(/^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/);
const credentialsSchema = z
  .object({
    username: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z0-9_-]+$/),
    password: z.string().min(32).max(256),
  })
  .readonly();
const hostedEnvSchema = envSchema.extend({
  ENABLE_REPAIR_SANDBOX: z.literal("false").default("false"),
  APP_PUBLIC_ORIGINS: z.string().optional(),
  VERCEL_URL: hostSchema.optional(),
  VERCEL_PROJECT_PRODUCTION_URL: hostSchema.optional(),
  HOSTED_USERNAME: z.string().optional(),
  HOSTED_PASSWORD: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  HOSTED_QUOTA_NAMESPACE: z.string().optional(),
  HOSTED_TOTAL_CALL_LIMIT: z.string().optional(),
  HOSTED_MINUTE_CALL_LIMIT: z.string().optional(),
});

export function parseHostedConfig(environment: unknown) {
  const env = hostedEnvSchema.parse(environment);
  const explicit = env.APP_PUBLIC_ORIGINS?.split(",").map((value) => value.trim()) ?? [];
  const vercel = [env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter((value) => value !== undefined)
    .map((host) => `https://${host}`);
  const trustedOrigins = z
    .array(originSchema)
    .min(1)
    .parse([...explicit, ...vercel]);
  const credentials =
    env.ENABLE_LIVE_AI === "true" ||
    env.HOSTED_USERNAME !== undefined ||
    env.HOSTED_PASSWORD !== undefined
      ? credentialsSchema.parse({ username: env.HOSTED_USERNAME, password: env.HOSTED_PASSWORD })
      : undefined;
  const quota =
    env.ENABLE_LIVE_AI === "true"
      ? quotaConfigSchema.parse({
          endpoint: env.UPSTASH_REDIS_REST_URL,
          token: env.UPSTASH_REDIS_REST_TOKEN,
          namespace: env.HOSTED_QUOTA_NAMESPACE,
          totalLimit: env.HOSTED_TOTAL_CALL_LIMIT,
          minuteLimit: env.HOSTED_MINUTE_CALL_LIMIT,
        })
      : undefined;
  if (env.ENABLE_LIVE_AI === "true") z.string().trim().min(1).parse(env.NEBIUS_API_KEY);
  return { config: envSchema.parse(env), trustedOrigins, credentials, quota };
}
export type HostedConfig = ReturnType<typeof parseHostedConfig>;
