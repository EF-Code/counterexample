import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execute = promisify(execFile);
const cli = fileURLToPath(new URL("../scripts/submission-evidence.ts", import.meta.url));
describe("submission evidence command", () => {
  it("writes an inspectable packet when the actual CLI runs in a clean environment", async () => {
    // Given a fresh output path and no credential environment.
    const root = await mkdtemp(join(tmpdir(), "counterexample-packet-cli-"));
    const output = join(root, "packet");
    try {
      // When the actual Node entrypoint runs.
      const result = await execute(process.execPath, [cli, "--output", output], {
        env: {},
        timeout: 10000,
      });
      const response: unknown = JSON.parse(result.stdout);
      // Then it exports reference evidence without model activity.
      expect(response).toMatchObject({
        outputDirectory: output,
        manifest: { aiRequestsMade: 0, liveAiProofIncluded: false, sandbox: { status: "not_run" } },
      });
      expect(await readFile(join(output, "manifest.json"), "utf8")).toContain(
        '"authored_single_purchase_fixture"',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
