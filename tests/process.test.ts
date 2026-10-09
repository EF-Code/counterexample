import { execFile, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import ky from "ky";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const execute = promisify(execFile);
const isolatedEnv = {
  ...process.env,
  NODE_ENV: "production",
  ENABLE_LIVE_AI: "false",
  NEBIUS_API_KEY: "",
  NEBIUS_MODEL: "nvidia/nemotron-3-super-120b-a12b",
  PORT: "0",
};

describe("native Node entrypoints", () => {
  it("exports evidence when the CLI is executed as a separate process", async () => {
    // Given the real CLI entrypoint with paid inference disabled.
    const args = ["src/demo.ts"];
    // When native Node executes TypeScript directly.
    const result = await execute(process.execPath, args, { env: isolatedEnv });
    const evidence: unknown = JSON.parse(result.stdout);
    // Then evidence reflects actual fixture execution, not an AI claim.
    expect(evidence).toMatchObject({
      reduced: ["charge_timeout", "retry"],
      before: { holds: false, chargedCents: 5000 },
      referenceControl: { holds: true, chargedCents: 2500 },
    });
  });

  it("serves evidence when the real server boots on an ephemeral port", async () => {
    // Given an isolated server process and an OS-assigned port.
    const child = spawn(process.execPath, ["src/server.ts"], {
      env: isolatedEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
    const lines = createInterface({ input: child.stdout });
    const ready = new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", () => reject(new Error("Server exited before readiness")));
      lines.on("line", (line) => {
        const record: unknown = JSON.parse(line);
        const result = z.object({ port: z.number().int().positive() }).safeParse(record);
        if (result.success) resolve(result.data.port);
      });
    });
    try {
      // When the actual server entrypoint serves a network request.
      const port = await ready;
      const result = await ky.get(`http://127.0.0.1:${port}/api/demo`).json();
      // Then the executable service exposes the same reviewed fixture behavior.
      expect(result).toMatchObject({
        before: { holds: false, successfulCharges: 2 },
        referenceControl: { holds: true, successfulCharges: 1 },
      });
    } finally {
      lines.close();
      child.kill("SIGTERM");
      await exited;
    }
  });

  it("fails safely when the server model configuration is invalid", async () => {
    // Given an invalid model ID without loading any local credential file.
    const env = { ...isolatedEnv, NEBIUS_MODEL: "unsupported-model" };
    // When the server entrypoint is executed.
    const result = execute(process.execPath, ["src/server.ts"], { env });
    // Then startup fails instead of guessing another model.
    await expect(result).rejects.toMatchObject({ code: 1 });
  });
});
