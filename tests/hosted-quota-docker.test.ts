import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  HostedQuotaError,
  quotaConfigSchema,
  reserveHostedInference,
} from "../src/hosted-quota.ts";

const execute = promisify(execFile);
const name = `counterexample-redis-${randomUUID()}`;
let server: ReturnType<typeof serve> | undefined;
let endpoint = "";

describe.runIf(process.env["COUNTEREXAMPLE_TEST_DOCKER"] === "true")("durable hosted quota", () => {
  beforeAll(async () => {
    await execute("docker", [
      "run",
      "-d",
      "--rm",
      "--name",
      name,
      "--network",
      "none",
      "redis:7-alpine",
      "redis-server",
      "--save",
      "",
      "--appendonly",
      "no",
    ]);
    const rest = new Hono();
    rest.post("/", async (c) => {
      if (c.req.header("authorization") !== "Bearer test-only-token") return c.json({}, 401);
      const body: unknown = await c.req.json();
      const command = z.array(z.union([z.string(), z.number()])).parse(body);
      const output = await execute("docker", [
        "exec",
        name,
        "redis-cli",
        "--json",
        ...command.map(String),
      ]);
      const result: unknown = JSON.parse(output.stdout);
      return c.json({ result });
    });
    endpoint = await new Promise<string>((resolve) => {
      server = serve({ fetch: rest.fetch, hostname: "127.0.0.1", port: 0 }, (info) =>
        resolve(`http://127.0.0.1:${info.port}`),
      );
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      if (server === undefined) return resolve();
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await execute("docker", ["rm", "-f", name]);
  });

  it("caps concurrent reservations across independent server instances", async () => {
    // Given a shared durable budget allowing only three calls.
    const config = quotaConfigSchema.parse({
      endpoint: "https://test.upstash.io",
      token: "test-only-token",
      namespace: "concurrency",
      totalLimit: 3,
      minuteLimit: 60,
    });
    // When twelve independent clients reserve calls concurrently through the real Redis script.
    const results = await Promise.all(
      Array.from({ length: 12 }, () => reserveHostedInference({ ...config }, endpoint)),
    );
    // Then exactly three reservations succeed, independent of process-local state.
    expect(results.filter(Boolean)).toHaveLength(3);
  });

  it("preserves the lifetime budget after the short-window key is removed", async () => {
    // Given an already-exhausted persistent budget and a fresh short window.
    const config = quotaConfigSchema.parse({
      endpoint: "https://test.upstash.io",
      token: "test-only-token",
      namespace: "lifetime",
      totalLimit: 1,
    });
    await reserveHostedInference(config, endpoint);
    await execute("docker", ["exec", name, "redis-cli", "DEL", "counterexample:lifetime:minute"]);
    // When a new instance tries to reserve another call.
    const result = await reserveHostedInference({ ...config }, endpoint);
    // Then the non-expiring lifetime cap still denies it.
    expect(result).toBe(false);
  });

  it("enforces the short-window cap independently of the lifetime cap", async () => {
    // Given a large lifetime budget with one call per short window.
    const config = quotaConfigSchema.parse({
      endpoint: "https://test.upstash.io",
      token: "test-only-token",
      namespace: "minute",
      totalLimit: 100,
      minuteLimit: 1,
    });
    await reserveHostedInference(config, endpoint);
    // When another instance requests admission in the same window.
    const result = await reserveHostedInference({ ...config }, endpoint);
    // Then it is denied before any model request.
    expect(result).toBe(false);
  });

  it("fails closed when the quota service rejects its credential", async () => {
    // Given a quota service with invalid caller credentials.
    const config = quotaConfigSchema.parse({
      endpoint: "https://test.upstash.io",
      token: "invalid-test-token",
      namespace: "outage",
    });
    // When admission is attempted, then no permissive fallback exists.
    await expect(reserveHostedInference(config, endpoint)).rejects.toBeInstanceOf(HostedQuotaError);
  });
});
