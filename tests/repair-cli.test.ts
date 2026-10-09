import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execute = promisify(execFile);
const cli = fileURLToPath(new URL("../src/repair-cli.ts", import.meta.url));

describe("repair CLI consent and approval", () => {
  it("blocks verification before file reads when explicit approval is absent", async () => {
    // Given a proposal path that must not be read without approval.
    const args = [cli, "verify", "--proposal", "/unused-proposal", "--output", "/unused-output"];
    // When the actual CLI is invoked without --approve.
    const result = execute(process.execPath, args, { env: {}, timeout: 5000 });
    // Then the operation fails at the approval gate.
    await expect(result).rejects.toMatchObject({ code: 2, stderr: "approval_required\n" });
  });

  it("blocks live source transmission when consent is absent", async () => {
    // Given a requested live proposal without source-sharing consent.
    const args = [
      cli,
      "propose",
      "--project",
      "/unused-project",
      "--output",
      "/unused-output",
      "--live",
    ];
    // When the actual CLI is invoked.
    const result = execute(process.execPath, args, { env: {}, timeout: 5000 });
    // Then it fails before source reads, Docker execution or model calls.
    await expect(result).rejects.toMatchObject({ code: 2, stderr: "source_consent_required\n" });
  });

  it("blocks a live proposal when server-side inference is not enabled", async () => {
    // Given consent but no environment opt-in or configured key.
    const args = [
      cli,
      "propose",
      "--project",
      "/unused-project",
      "--output",
      "/unused-output",
      "--live",
      "--consent-send-source",
    ];
    // When the CLI is invoked in a clean environment.
    const result = execute(process.execPath, args, { env: {}, timeout: 5000 });
    // Then paid inference remains disabled.
    await expect(result).rejects.toMatchObject({ code: 2, stderr: "live_ai_disabled\n" });
  });
});
