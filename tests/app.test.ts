import { serve } from "@hono/node-server";
import ky from "ky";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { envSchema } from "../src/config.ts";

const config = envSchema.parse({});
const app = createApp(config);
let server: ReturnType<typeof serve> | undefined;
let baseUrl = "";

beforeAll(async () => {
  baseUrl = await new Promise<string>((resolve) => {
    server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 }, (info) => {
      resolve(`http://127.0.0.1:${info.port}`);
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    if (server === undefined) return resolve();
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("local HTTP surface", () => {
  it("compresses built JavaScript when the browser accepts gzip", async () => {
    // Given the script URL in the built browser entrypoint.
    const html = await ky.get(baseUrl).text();
    const path = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
    if (path === undefined) throw new Error("Built browser script is missing");
    // When a browser requests the script with compression support.
    const response = await ky.get(`${baseUrl}${path}`, { headers: { "accept-encoding": "gzip" } });
    // Then network transfer uses gzip while the client receives decodable JavaScript.
    expect(response.headers.get("content-encoding")).toBe("gzip");
    expect((await response.text()).length).toBeGreaterThan(0);
  });

  it("serves the browser entrypoint when the root route is requested", async () => {
    // Given the built browser assets and the local server.
    const url = baseUrl;
    // When the root route is requested.
    const response = await ky.get(url);
    // Then it serves HTML rather than API metadata.
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("<main");
  });

  it.each(["/.env", "/src/config.ts", "/web/main.ts", "/package.json"])(
    "keeps development files private when %s is requested",
    async (path) => {
      // Given a path outside the public asset allowlist.
      const url = `${baseUrl}${path}`;
      // When a client requests it.
      const response = await ky.get(url, { throwHttpErrors: false, retry: 0 });
      // Then the source or secret file is not served.
      expect(response.status).toBe(404);
    },
  );

  it("rejects browser requests when their origin is a different website", async () => {
    // Given a browser request originating outside the local application.
    const json = { workflow: "vulnerable", actions: ["charge_timeout", "retry"] };
    // When a cross-origin request attempts to execute a local operation.
    const response = await ky.post(`${baseUrl}/api/replay`, {
      json,
      headers: { origin: "https://untrusted.example" },
      throwHttpErrors: false,
    });
    // Then it is blocked before processing the body.
    expect(response.status).toBe(403);
  });

  it("rejects DNS-rebinding requests when the host is not loopback", async () => {
    // Given a request whose URL uses an attacker-controlled hostname.
    const request = new Request("http://untrusted.example/api/demo");
    // When the application receives that request.
    const response = await app.request(request);
    // Then local binding cannot be bypassed by a hostname resolving to loopback.
    expect(response.status).toBe(403);
  });

  it("requires JSON content type when a client submits an operation", async () => {
    // Given a browser-simple content type that would bypass a JSON preflight.
    const body = JSON.stringify({ workflow: "vulnerable", actions: ["retry"] });
    // When the request uses text/plain.
    const response = await ky.post(`${baseUrl}/api/replay`, {
      body,
      headers: { "content-type": "text/plain" },
      throwHttpErrors: false,
    });
    // Then only the explicit JSON API contract is accepted.
    expect(response.status).toBe(415);
  });

  it("rejects oversized bodies when the request exceeds the byte limit", async () => {
    // Given a body larger than sixteen kibibytes.
    const body = JSON.stringify({ payload: "x".repeat(17 * 1024) });
    // When it reaches the API boundary.
    const response = await ky.post(`${baseUrl}/api/replay`, {
      body,
      headers: { "content-type": "application/json" },
      throwHttpErrors: false,
    });
    // Then it is rejected before schema processing.
    expect(response.status).toBe(413);
  });

  it("exports reproducible evidence when the demo endpoint is requested", async () => {
    // Given the running server without an API key.
    const url = `${baseUrl}/api/demo`;
    // When evidence is requested over HTTP.
    const result = await ky.get(url).json();
    // Then the failure and hand-authored reference are distinguishable.
    expect(result).toMatchObject({
      provenance: "deterministic_fixture",
      reduced: ["charge_timeout", "retry"],
      before: { holds: false, successfulCharges: 2 },
      referenceControl: { holds: true, successfulCharges: 1 },
    });
  });

  it("replays a submitted schedule when the input is valid", async () => {
    // Given a bounded schedule for the fixed control.
    const json = { workflow: "idempotent", actions: ["charge_timeout", "restart", "retry"] };
    // When the real API executes it.
    const result = await ky.post(`${baseUrl}/api/replay`, { json }).json();
    // Then the control holds for this schedule.
    expect(result).toMatchObject({ holds: true, successfulCharges: 1 });
  });

  it.each([
    { workflow: "vulnerable", actions: ["run_shell"] },
    { workflow: "vulnerable", actions: Array.from({ length: 21 }, () => "observe") },
    { workflow: "vulnerable", actions: [], code: "untrusted code" },
  ])(
    "rejects requests when unsupported actions or execution fields are submitted",
    async (json) => {
      // Given untrusted input outside the fixture contract.
      const url = `${baseUrl}/api/replay`;
      // When the request reaches the API boundary.
      const response = await ky.post(url, { json, throwHttpErrors: false });
      // Then it is rejected rather than executed.
      expect(response.status).toBe(400);
    },
  );

  it("rejects malformed JSON when a client sends an invalid body", async () => {
    // Given an invalid JSON document.
    const body = "{";
    // When the document reaches the boundary.
    const response = await ky.post(`${baseUrl}/api/replay`, {
      body,
      headers: { "content-type": "application/json" },
      throwHttpErrors: false,
    });
    // Then the result is a client error, not a server crash.
    expect(response.status).toBe(400);
  });

  it("blocks paid inference when live AI has not been explicitly enabled", async () => {
    // Given a disabled live-inference configuration.
    const json = { promise: "Never charge twice for one purchase.", consentToSend: true };
    // When a client requests inference.
    const response = await ky.post(`${baseUrl}/api/interpret`, { json, throwHttpErrors: false });
    // Then no provider call is made.
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "live_ai_disabled" });
  });

  it("bounds search when an excessive depth is submitted", async () => {
    // Given a combinatorially expensive search request.
    const json = { workflow: "vulnerable", maxDepth: 100 };
    // When the request is submitted.
    const response = await ky.post(`${baseUrl}/api/explore`, { json, throwHttpErrors: false });
    // Then the boundary enforces the supported bound.
    expect(response.status).toBe(400);
  });
});
