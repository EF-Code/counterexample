import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { envSchema } from "../src/config.ts";
import { repairSessionSchema } from "../src/repair-web-contract.ts";
import { createRepairService } from "../src/repair-web-service.ts";

describe("curated browser repair boundaries", () => {
  it("disables execution when the sandbox environment opt-in is absent", async () => {
    // Given default configuration and an attempted reference repair.
    const app = createApp(envSchema.parse({}));
    // When a client requests a proposal.
    const response = await app.request("http://localhost/api/repair/propose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"mode":"reference"}',
    });
    // Then no Docker or model work is started.
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "repair_disabled" });
  });

  it("requires the session capability when execution is enabled", async () => {
    // Given an enabled, local-only curated repair service.
    const config = envSchema.parse({ ENABLE_REPAIR_SANDBOX: "true" });
    const service = createRepairService(config);
    const app = createApp(config, service);
    try {
      // When a request omits its session capability.
      const response = await app.request("http://localhost/api/repair/propose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"mode":"reference"}',
      });
      // Then it fails before source or execution access.
      expect(response.status).toBe(403);
    } finally {
      await service.close();
    }
  });

  it.each([
    { mode: "reference", projectDirectory: "/private" },
    { mode: "reference", command: "execute arbitrary code" },
    { mode: "nebius", consentToSendSource: false },
  ])(
    "rejects caller-controlled execution fields when the request crosses the boundary",
    async (body) => {
      // Given a valid capability but a request outside the curated contract.
      const config = envSchema.parse({ ENABLE_REPAIR_SANDBOX: "true" });
      const service = createRepairService(config);
      const app = createApp(config, service);
      const session = repairSessionSchema.parse(
        await (await app.request("http://localhost/api/repair/session")).json(),
      );
      try {
        // When untrusted fields are posted.
        const response = await app.request("http://localhost/api/repair/propose", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-counterexample-token": session.token ?? "",
          },
          body: JSON.stringify(body),
        });
        // Then paths, commands and missing consent are refused.
        expect(response.status).toBe(400);
      } finally {
        await service.close();
      }
    },
  );

  it("rejects non-ASCII capability values when their character length mimics the token", async () => {
    // Given a hostile header with different byte and character lengths.
    const config = envSchema.parse({ ENABLE_REPAIR_SANDBOX: "true" });
    const service = createRepairService(config);
    const app = createApp(config, service);
    try {
      // When constant-time comparison receives the malformed header.
      const response = await app.request("http://localhost/api/repair/propose", {
        method: "POST",
        headers: { "content-type": "application/json", "x-counterexample-token": "é".repeat(64) },
        body: '{"mode":"reference"}',
      });
      // Then input is rejected as authorization failure rather than crashing the comparison.
      expect(response.status).toBe(403);
    } finally {
      await service.close();
    }
  });
});
