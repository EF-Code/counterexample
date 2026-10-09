import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { analyzeAdapter } from "../src/adapter-runner.ts";
import { exportRegression } from "../src/regression-export.ts";

const execute = promisify(execFile);
const buggy = `export function createWorkflow(provider) {
  let confirmed = false;
  return { attempt() {
    if (confirmed) return;
    confirmed = provider.charge(null) === "acknowledged";
  } };
}`;
const fixed = buggy.replace("provider.charge(null)", 'provider.charge("purchase:one")');

describe("runnable regression export", () => {
  it("fails on the bug and passes on the fix when the exported test runs without Counterexample installed", async () => {
    // Given a reviewed local adapter and an observed failure.
    const directory = await mkdtemp(join(tmpdir(), "counterexample-export-"));
    const adapterPath = join(directory, "adapter.mjs");
    try {
      await writeFile(adapterPath, buggy);
      const report = await analyzeAdapter({ adapterPath, actions: ["charge_timeout", "retry"] });
      // When the regression test is exported and run against both implementations.
      const outputDirectory = join(directory, "regression");
      await exportRegression({ adapterPath, outputDirectory, report });
      const args = [
        "--test",
        "--test-reporter=tap",
        join(outputDirectory, "counterexample.test.ts"),
      ];
      const broken = execute(process.execPath, args, { cwd: directory, env: {}, timeout: 5000 });
      // Then the generated property test detects the original defect.
      await expect(broken).rejects.toMatchObject({ code: 1 });
      await writeFile(adapterPath, fixed);
      const passing = await execute(process.execPath, args, {
        cwd: directory,
        env: {},
        timeout: 5000,
      });
      expect(passing.stdout).toContain("# pass 1");
      await writeFile(adapterPath, "export function createWorkflow() { return { attempt() {} }; }");
      const disabledBilling = execute(process.execPath, args, {
        cwd: directory,
        env: {},
        timeout: 5000,
      });
      await expect(disabledBilling).rejects.toMatchObject({ code: 1 });
      expect(
        await readFile(join(outputDirectory, "counterexample.runtime.ts"), "utf8"),
      ).not.toContain('from "zod"');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("preserves an existing output directory when an export would overwrite user files", async () => {
    // Given an output directory already containing a user's file.
    const directory = await mkdtemp(join(tmpdir(), "counterexample-preserve-"));
    const adapterPath = join(directory, "adapter.mjs");
    try {
      await writeFile(adapterPath, buggy);
      const report = await analyzeAdapter({ adapterPath, actions: ["charge_timeout", "retry"] });
      // When export targets the existing directory.
      const result = exportRegression({ adapterPath, outputDirectory: directory, report });
      // Then export refuses without overwriting any file.
      await expect(result).rejects.toMatchObject({ code: "output_directory_exists" });
      expect(await readFile(adapterPath, "utf8")).toBe(buggy);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
