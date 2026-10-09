import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { envSchema } from "../src/config.ts";
import { HostedQuotaError } from "../src/hosted-quota.ts";

const origin = "https://counterexample.example";
const config = envSchema.parse({});

describe("hosted API boundary", () => {
  it("denies paid requests before inference when the durable budget is exhausted", async () => {
    // Given live mode with a durable admission gate denying the request.
    const live = envSchema.parse({ ENABLE_LIVE_AI: "true", NEBIUS_API_KEY: "test-only-key" });
    const app = createApp(live, undefined, {
      trustedOrigins: [origin],
      serveAssets: false,
      reserveInference: async () => false,
    });
    // When a valid consented request arrives.
    const response = await app.request(`${origin}/api/interpret`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        promise: "Never charge twice for one purchase.",
        consentToSend: true,
      }),
    });
    // Then no inference is performed and exhaustion is explicit.
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "hosted_inference_limit" });
  });

  it("fails closed at the HTTP boundary when durable admission is unavailable", async () => {
    // Given a live request whose durable gate is unavailable.
    const live = envSchema.parse({ ENABLE_LIVE_AI: "true", NEBIUS_API_KEY: "test-only-key" });
    const app = createApp(live, undefined, {
      trustedOrigins: [origin],
      serveAssets: false,
      reserveInference: async () => {
        throw new HostedQuotaError();
      },
    });
    // When a valid request reaches admission.
    const response = await app.request(`${origin}/api/interpret`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        promise: "Never charge twice for one purchase.",
        consentToSend: true,
      }),
    });
    // Then provider execution is denied rather than falling back to memory limits.
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "inference_budget_unavailable" });
  });

  it("validates consent before reserving a paid-request slot", async () => {
    // Given a live API with a counting admission gate.
    const live = envSchema.parse({ ENABLE_LIVE_AI: "true", NEBIUS_API_KEY: "test-only-key" });
    let reservations = 0;
    const app = createApp(live, undefined, {
      trustedOrigins: [origin],
      serveAssets: false,
      reserveInference: async () => {
        reservations += 1;
        return false;
      },
    });
    // When an invalid request omits transmission consent.
    const response = await app.request(`${origin}/api/interpret`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ promise: "Never charge twice for one purchase." }),
    });
    // Then validation rejects it without consuming a budget slot.
    expect(response.status).toBe(400);
    expect(reservations).toBe(0);
  });
  it("serves fixture evidence when the public origin is explicitly trusted", async () => {
    // Given a deployment with one exact trusted public origin.
    const app = createApp(config, undefined, { trustedOrigins: [origin], serveAssets: false });
    // When the browser requests fixture evidence.
    const response = await app.request(`${origin}/api/demo`);
    // Then the backend returns the actual deterministic failure.
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ before: { successfulCharges: 2 } });
  });

  it("rejects an untrusted host even when it claims a trusted forwarded host", async () => {
    // Given an explicit public-host allowlist.
    const app = createApp(config, undefined, { trustedOrigins: [origin], serveAssets: false });
    // When a client spoofs proxy metadata from an untrusted request URL.
    const response = await app.request("https://attacker.example/api/demo", {
      headers: { "x-forwarded-host": "counterexample.example" },
    });
    // Then the spoofed header cannot authorize the request.
    expect(response.status).toBe(403);
  });

  it("rejects cross-origin operations at a trusted public host", async () => {
    // Given an otherwise accessible hosted API.
    const app = createApp(config, undefined, { trustedOrigins: [origin], serveAssets: false });
    // When another site attempts a JSON operation.
    const response = await app.request(`${origin}/api/replay`, {
      method: "POST",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: JSON.stringify({ workflow: "vulnerable", actions: ["retry"] }),
    });
    // Then the operation is blocked before execution.
    expect(response.status).toBe(403);
  });

  it("keeps static files out of the function when CDN serving is selected", async () => {
    // Given a public API whose assets belong to the CDN.
    const app = createApp(config, undefined, { trustedOrigins: [origin], serveAssets: false });
    // When the function receives a static document request.
    const response = await app.request(`${origin}/`);
    // Then it does not attempt filesystem-based HTML serving.
    expect(response.status).toBe(404);
  });
});
