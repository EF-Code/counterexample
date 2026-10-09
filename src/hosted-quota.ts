import ky from "ky";
import { z } from "zod";

export const quotaConfigSchema = z
  .object({
    endpoint: z.url().refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        url.hostname.endsWith(".upstash.io") &&
        url.username === "" &&
        url.password === "" &&
        url.pathname === "/" &&
        url.search === "" &&
        url.hash === ""
      );
    }),
    token: z.string().min(1),
    namespace: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    totalLimit: z.coerce.number().int().min(1).max(10000).default(100),
    minuteLimit: z.coerce.number().int().min(1).max(60).default(5),
  })
  .readonly();
export type QuotaConfig = z.infer<typeof quotaConfigSchema>;

export class HostedQuotaError extends Error {
  readonly code = "quota_unavailable";
  constructor() {
    super("quota_unavailable");
    this.name = "HostedQuotaError";
  }
}

export const reservationScript = `
local total = tonumber(redis.call('GET', KEYS[1]) or '0')
local minute = tonumber(redis.call('GET', KEYS[2]) or '0')
if total >= tonumber(ARGV[1]) or minute >= tonumber(ARGV[2]) then return 0 end
redis.call('INCR', KEYS[1])
local count = redis.call('INCR', KEYS[2])
if count == 1 then redis.call('EXPIRE', KEYS[2], 60) end
return 1
`;

export async function reserveHostedInference(
  config: QuotaConfig,
  endpoint = config.endpoint,
): Promise<boolean> {
  try {
    const body: unknown = await ky
      .post(endpoint, {
        headers: { authorization: `Bearer ${config.token}` },
        json: [
          "EVAL",
          reservationScript,
          2,
          `counterexample:${config.namespace}:total`,
          `counterexample:${config.namespace}:minute`,
          config.totalLimit,
          config.minuteLimit,
        ],
        retry: 0,
        redirect: "error",
        timeout: 3000,
      })
      .json<unknown>();
    return z.object({ result: z.union([z.literal(0), z.literal(1)]) }).parse(body).result === 1;
  } catch (error) {
    if (error instanceof Error) throw new HostedQuotaError();
    throw error;
  }
}
