import { describe, expect, it } from "vitest";
import { parseHostedConfig } from "../src/hosted-config.ts";

const live = {
  VERCEL_URL: "counterexample-test.vercel.app",
  ENABLE_LIVE_AI: "true",
  NEBIUS_API_KEY: "test-only-model-key",
  HOSTED_USERNAME: "judge",
  HOSTED_PASSWORD: "test-only-password-with-32-characters",
  UPSTASH_REDIS_REST_URL: "https://test-only.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "test-only-redis-token",
  HOSTED_QUOTA_NAMESPACE: "test-only-budget",
};

describe("hosted configuration", () => {
  it("supports an offline Vercel deployment without any model credentials", () => {
    // Given Vercel's exact deployment and production hostnames.
    const env = { VERCEL_URL: "preview.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "demo.example" };
    // When the hosted configuration is parsed.
    const config = parseHostedConfig(env);
    // Then both exact HTTPS origins are trusted and paid features remain off.
    expect(config.trustedOrigins).toEqual(["https://preview.vercel.app", "https://demo.example"]);
    expect(config.config.ENABLE_LIVE_AI).toBe("false");
    expect(config.config.ENABLE_REPAIR_SANDBOX).toBe("false");
  });

  it.each([
    "HOSTED_PASSWORD",
    "HOSTED_USERNAME",
    "NEBIUS_API_KEY",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "HOSTED_QUOTA_NAMESPACE",
  ])("rejects live mode when %s is missing", (missing) => {
    // Given live mode with one mandatory safeguard omitted.
    const env = Object.fromEntries(Object.entries(live).filter(([key]) => key !== missing));
    // When configuration is parsed, then it fails closed.
    expect(() => parseHostedConfig(env)).toThrow();
  });

  it.each([
    "http://demo.example",
    "https://demo.example/path",
    "https://user:pass@demo.example",
    "https://demo.example?token=bad",
    "https://*.vercel.app",
  ])("rejects unsafe explicit origins when configured as %s", (APP_PUBLIC_ORIGINS) => {
    // Given a malformed or unsafe trusted-origin entry.
    const env = { APP_PUBLIC_ORIGINS };
    // When configuration is parsed, then it rejects the entry.
    expect(() => parseHostedConfig(env)).toThrow();
  });

  it("rejects Docker opt-in on the hosted serverless entrypoint", () => {
    // Given an attempt to enable the local Docker service on Vercel.
    const env = { VERCEL_URL: "demo.vercel.app", ENABLE_REPAIR_SANDBOX: "true" };
    // When configuration is parsed, then it rejects unsupported execution.
    expect(() => parseHostedConfig(env)).toThrow();
  });

  it("requires an origin instead of trusting arbitrary request headers", () => {
    // Given no configured deployment or public origin.
    const env = {};
    // When configuration is parsed, then it refuses public operation.
    expect(() => parseHostedConfig(env)).toThrow();
  });

  it("parses required authentication and durable quotas when live mode is enabled", () => {
    // Given complete operator-only live configuration.
    const env = live;
    // When it is parsed for server-side use.
    const config = parseHostedConfig(env);
    // Then durable limits and authentication are mandatory typed settings.
    expect(config.quota).toMatchObject({ totalLimit: 100, minuteLimit: 5 });
    expect(config.credentials?.username).toBe("judge");
  });
});
