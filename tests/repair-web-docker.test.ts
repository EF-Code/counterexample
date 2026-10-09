import { serve } from "@hono/node-server";
import ky from "ky";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { envSchema } from "../src/config.ts";
import {
  proposalViewSchema,
  repairSessionSchema,
  verifiedViewSchema,
} from "../src/repair-web-contract.ts";
import { createRepairService } from "../src/repair-web-service.ts";

describe.runIf(process.env["COUNTEREXAMPLE_TEST_DOCKER"] === "true")(
  "curated repair HTTP integration",
  () => {
    const config = envSchema.parse({ ENABLE_REPAIR_SANDBOX: "true", ENABLE_LIVE_AI: "false" });
    const repairs = createRepairService(config);
    const app = createApp(config, repairs);
    let server: ReturnType<typeof serve> | undefined;
    let baseUrl = "";
    beforeAll(async () => {
      baseUrl = await new Promise<string>((resolve) => {
        server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 }, (info) =>
          resolve(`http://127.0.0.1:${info.port}`),
        );
      });
    });
    afterAll(async () => {
      await new Promise<void>((resolve, reject) => {
        if (server === undefined) return resolve();
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await repairs.close();
    });

    it("verifies and exports the curated candidate when the exact proposal is approved", async () => {
      // Given a real local HTTP server and its capability-protected repair session.
      const session = repairSessionSchema.parse(
        await ky.get(`${baseUrl}/api/repair/session`).json(),
      );
      const headers = { "x-counterexample-token": session.token ?? "" };
      // When a reference proposal is requested and explicitly approved over HTTP.
      const proposal = proposalViewSchema.parse(
        await ky
          .post(`${baseUrl}/api/repair/propose`, {
            headers,
            json: { mode: "reference" },
            timeout: 60000,
          })
          .json(),
      );
      const request = {
        jobId: proposal.jobId,
        proposalHash: proposal.proposalHash,
        approved: true,
      };
      const verified = verifiedViewSchema.parse(
        await ky
          .post(`${baseUrl}/api/repair/verify`, { headers, json: request, timeout: 60000 })
          .json(),
      );
      // Then actual Docker execution passes and the cached result is idempotent.
      expect(verified).toMatchObject({
        accepted: true,
        regressionPassed: true,
        verification: { violationsFound: 0, schedulesChecked: 780 },
      });
      const repeated = await ky
        .post(`${baseUrl}/api/repair/verify`, { headers, json: request })
        .json();
      expect(repeated).toEqual(verified);
      const bundle = await ky
        .get(`${baseUrl}/api/repair/artifacts/${proposal.jobId}/repair-bundle.json`, { headers })
        .json();
      expect(bundle).toMatchObject({ formatVersion: 1, source: "reference" });
      const mismatch = await ky.post(`${baseUrl}/api/repair/verify`, {
        headers,
        json: { ...request, proposalHash: "0".repeat(64) },
        throwHttpErrors: false,
      });
      expect(mismatch.status).toBe(409);
    }, 60000);
  },
);
