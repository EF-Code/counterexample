import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { analyzeAdapter } from "../src/adapter-runner.ts";

const adapterPath = fileURLToPath(
  new URL("../examples/billing-service/counterexample.adapter.ts", import.meta.url),
);
const fixedPath = fileURLToPath(
  new URL("../examples/billing-service/fixed.adapter.ts", import.meta.url),
);

describe("local repository adapter subprocess", () => {
  it("strips credentials when the adapter subprocess is started", async () => {
    // Given a dummy credential in the parent environment and a reviewed adapter checking for leakage.
    const directory = await mkdtemp(join(tmpdir(), "counterexample-env-"));
    const path = join(directory, "adapter.mjs");
    vi.stubEnv("NEBIUS_API_KEY", "test-only-sentinel");
    try {
      await writeFile(
        path,
        `export function createWorkflow(provider) {
        if (process.env.NEBIUS_API_KEY) throw new Error("credential_inherited");
        return {attempt() { provider.charge(null); }};
      }`,
      );
      // When the parent launches the actual adapter worker.
      const report = await analyzeAdapter({
        adapterPath: path,
        actions: ["charge_timeout", "retry"],
      });
      // Then the adapter executes without inheriting the dummy credential.
      expect(report.originalReplay.successfulCharges).toBe(2);
    } finally {
      vi.unstubAllEnvs();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("terminates execution when adapter initialization never returns", async () => {
    // Given a deliberately stuck adapter in an isolated test directory.
    const directory = await mkdtemp(join(tmpdir(), "counterexample-timeout-"));
    const path = join(directory, "adapter.mjs");
    try {
      await writeFile(path, "export function createWorkflow() { while (true) {} }");
      // When bounded execution reaches its five-second limit.
      const result = analyzeAdapter({ adapterPath: path, actions: ["charge"] });
      // Then the worker is killed and no report is accepted.
      await expect(result).rejects.toMatchObject({ code: "adapter_execution_limit_exceeded" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 10000);

  it.each([
    "export function createWorkflow() { return {attempt: async () => undefined}; }",
    "export function createWorkflow() { return {attempt: 42}; }",
    "export const createWorkflow = 42;",
  ])(
    "rejects invalid contracts when a module cannot produce a synchronous workflow",
    async (source) => {
      // Given invalid adapter exports.
      const directory = await mkdtemp(join(tmpdir(), "counterexample-contract-"));
      const path = join(directory, "adapter.mjs");
      try {
        await writeFile(path, source);
        // When the adapter contract is parsed and executed.
        const result = analyzeAdapter({ adapterPath: path, actions: ["charge"] });
        // Then invalid contracts cannot be reported as passing workflows.
        await expect(result).rejects.toMatchObject({ code: "adapter_contract_invalid" });
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  );

  it("finds the actual service failure when a reviewed adapter is loaded", async () => {
    // Given the authored example service behind a real module adapter.
    const request = {
      adapterPath,
      actions: ["observe", "charge_timeout", "restart", "retry"],
    } as const;
    // When the module executes in a subprocess.
    const report = await analyzeAdapter(request);
    // Then its provider behavior produces a replayable reduced violation.
    expect(report).toMatchObject({
      execution: "trusted_local_code",
      reducedActions: ["charge_timeout", "retry"],
      reducedReplay: { holds: false, successfulCharges: 2 },
    });
  });

  it("passes the same schedule when the reference adapter uses a stable key", async () => {
    // Given the hand-authored fixed adapter.
    const request = {
      adapterPath: fixedPath,
      actions: ["charge_timeout", "restart", "retry"],
    } as const;
    // When the same fault schedule executes.
    const report = await analyzeAdapter(request);
    // Then provider-observed state contains one charge.
    expect(report.originalReplay).toMatchObject({ holds: true, successfulCharges: 1 });
  });
});

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
