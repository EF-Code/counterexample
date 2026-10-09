import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execute = promisify(execFile);
const cli = fileURLToPath(new URL("../src/repository-cli.ts", import.meta.url));
const fixture = fileURLToPath(
  new URL("../examples/billing-service/counterexample.adapter.ts", import.meta.url),
);

describe("repository CLI entrypoint", () => {
  it("refuses module execution when explicit trust has not been granted", async () => {
    // Given an adapter with a detectable import-time side effect.
    const directory = await mkdtemp(join(tmpdir(), "counterexample-trust-"));
    const marker = join(directory, "executed.txt");
    const adapter = join(directory, "adapter.mjs");
    try {
      await writeFile(
        adapter,
        `import {writeFileSync} from "node:fs"; writeFileSync(${JSON.stringify(marker)}, "executed");`,
      );
      // When the CLI is called without the trust flag.
      const result = execute(process.execPath, [cli, "--adapter", adapter], {
        env: {},
        timeout: 5000,
      });
      // Then refusal occurs before the adapter is imported.
      await expect(result).rejects.toMatchObject({ code: 2, stderr: "trust_required\n" });
      await expect(access(marker)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("exports runnable evidence when a reviewed repository adapter is explicitly trusted", async () => {
    // Given the authored billing example and a fresh export directory.
    const directory = await mkdtemp(join(tmpdir(), "counterexample-cli-"));
    const output = join(directory, "export");
    try {
      // When the actual CLI analyzes and exports the failure.
      const result = await execute(
        process.execPath,
        [cli, "--adapter", fixture, "--trust-local-code", "--output", output],
        { env: {}, timeout: 10000 },
      );
      const report: unknown = JSON.parse(result.stdout);
      // Then the output includes observed failure and generated files.
      expect(report).toMatchObject({
        report: { reducedActions: ["charge_timeout", "retry"], reducedReplay: { holds: false } },
      });
      expect(await readFile(join(output, "evidence.json"), "utf8")).toContain(
        '"adapterEntrySha256"',
      );
      const generated = execute(
        process.execPath,
        ["--test", join(output, "counterexample.test.ts")],
        { env: {}, timeout: 5000 },
      );
      await expect(generated).rejects.toMatchObject({ code: 1 });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 20000);

  it("rejects execution fields when unsupported command options are supplied", async () => {
    // Given an unsupported option outside the CLI contract.
    const args = [cli, "--trust-local-code", "--adapter", fixture, "--shell", "arbitrary command"];
    // When strict argument parsing is applied.
    const result = execute(process.execPath, args, { env: {}, timeout: 5000 });
    // Then no requested command is executed.
    await expect(result).rejects.toMatchObject({ code: 2, stderr: "invalid_arguments\n" });
  });
});
