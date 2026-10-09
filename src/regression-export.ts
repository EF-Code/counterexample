import type { AdapterReport } from "./adapter-contract.ts";
import { RepositoryError } from "./adapter-runner.ts";
import type { BillingAction } from "./billing-runtime.ts";

export type ExportRequest = {
  readonly adapterPath: string;
  readonly outputDirectory: string;
  readonly report: AdapterReport;
};

export async function exportRegression(request: ExportRequest): Promise<readonly string[]> {
  if (request.report.reducedReplay.holds) throw new RepositoryError("no_counterexample");
  const outputDirectory = resolve(request.outputDirectory);
  const adapterPath = resolve(request.adapterPath);
  const runtime = await readFile(new URL("./billing-runtime.ts", import.meta.url), "utf8");
  const entry = await readFile(adapterPath);
  const path = relative(outputDirectory, adapterPath).split(sep).join("/");
  const specifier = path.startsWith(".") ? path : `./${path}`;
  const test = regressionSource(specifier, request.report.reducedActions);
  const manifest = {
    formatVersion: 1,
    execution: "trusted_local_code",
    adapter: specifier,
    adapterEntrySha256: createHash("sha256").update(entry).digest("hex"),
    runtimeSha256: createHash("sha256").update(runtime).digest("hex"),
    report: request.report,
    limitations: [
      "The entry hash does not cover transitive imports or the whole repository.",
      "This runtime is dependency-free; the adapter and its own dependencies must remain available.",
      "The exported test imports trusted local code with normal process privileges, not a sandbox.",
      "This is a generated regression test, not a generated repair or a correctness proof.",
    ],
  };
  const files = [
    ["counterexample.test.ts", test],
    ["counterexample.runtime.ts", runtime],
    ["evidence.json", JSON.stringify(manifest, null, 2)],
    ["package.json", JSON.stringify({ private: true, type: "module" }, null, 2)],
    [
      "README.md",
      [
        "# Captured billing regression",
        "",
        "Review the adapter before running: this imports trusted local code, not sandboxed code.",
        "Requires Node 24+; no Counterexample or test-framework installation is needed.",
        "Run from this folder: `node --test counterexample.test.ts`.",
        "The test should fail on the observed bug and pass after the adapter's implementation is fixed.",
        "Keep the adapter and its transitive imports at the relative paths recorded in evidence.json.",
        "The adapter entry hash covers only the entry file, not its dependencies. No AI repair is included.",
        "",
      ].join("\n"),
    ],
  ] as const;
  await mkdir(dirname(outputDirectory), { recursive: true });
  try {
    await mkdir(outputDirectory);
  } catch (error) {
    if (error instanceof Error) {
      const exists = z.object({ code: z.literal("EEXIST") }).safeParse(error);
      throw new RepositoryError(
        exists.success ? "output_directory_exists" : "export_directory_failed",
      );
    }
    throw error;
  }
  for (const [name, content] of files) {
    await writeFile(resolve(outputDirectory, name), content, { flag: "wx" });
  }
  return files.map(([name]) => resolve(outputDirectory, name));
}

export function regressionSource(specifier: string, actions: readonly BillingAction[]): string {
  return [
    'import assert from "node:assert/strict";',
    'import { test } from "node:test";',
    `import * as adapter from ${JSON.stringify(specifier)};`,
    'import { adaptBillingModule, runBillingSchedule } from "./counterexample.runtime.ts";',
    `const actions = ${JSON.stringify(actions)} as const;`,
    'test("at_most_one_charge_per_intent under the captured schedule", () => {',
    "  const result = runBillingSchedule(adaptBillingModule(adapter), actions);",
    "  assert.equal(result.holds, true, JSON.stringify({",
    "    property: result.property, successfulCharges: result.successfulCharges, trace: result.trace,",
    "  }));",
    '  assert.equal(result.successfulCharges, 1, "The captured purchase must still exercise the committing fake gateway");',
    "});",
    "",
  ].join("\n");
}

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { z } from "zod";
