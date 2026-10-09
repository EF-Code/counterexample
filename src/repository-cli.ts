import { parseArgs } from "node:util";
import { z } from "zod";
import { adapterRequestSchema } from "./adapter-contract.ts";
import { analyzeAdapter, RepositoryError } from "./adapter-runner.ts";
import { exportRegression } from "./regression-export.ts";

async function main(): Promise<void> {
  let options: ReturnType<typeof parseOptions>;
  try {
    options = parseOptions();
  } catch (error) {
    if (error instanceof Error) throw new RepositoryError("invalid_arguments");
    throw error;
  }
  if (options.help) {
    process.stdout.write(
      [
        "Counterexample local repository adapter",
        "",
        "node src/repository-cli.ts --adapter path/to/adapter.ts --trust-local-code [--output new-folder]",
        "Optional: --actions observe,charge_timeout,restart,observe,retry",
        "",
        "Imports reviewed local code with normal filesystem/network privileges. NOT a security sandbox.",
        "A worker has a 5-second timeout, 128 MiB V8 heap limit, and 256 KiB output limit.",
        "The worker does not inherit environment credentials; local files remain accessible.",
        "No packages are installed, no Nebius call is made, and no existing output folder is overwritten.",
        "",
      ].join("\n"),
    );
    return;
  }
  if (!options["trust-local-code"]) throw new RepositoryError("trust_required");
  const request = adapterRequestSchema.parse({
    adapterPath: options.adapter,
    actions: (options.actions ?? "observe,charge_timeout,restart,observe,retry")
      .split(",")
      .map((action) => action.trim()),
  });
  const report = await analyzeAdapter(request);
  const files =
    options.output === undefined
      ? []
      : await exportRegression({
          adapterPath: request.adapterPath,
          outputDirectory: options.output,
          report,
        });
  process.stdout.write(`${JSON.stringify({ report, files }, null, 2)}\n`);
}

function parseOptions() {
  return parseArgs({
    strict: true,
    allowPositionals: false,
    options: {
      adapter: { type: "string" },
      output: { type: "string" },
      actions: { type: "string" },
      "trust-local-code": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  }).values;
}

try {
  await main();
} catch (error) {
  if (error instanceof RepositoryError) process.stderr.write(`${error.code}\n`);
  else if (error instanceof z.ZodError) process.stderr.write("invalid_arguments\n");
  else if (error instanceof Error) process.stderr.write("repository_operation_failed\n");
  else process.stderr.write("repository_operation_failed\n");
  process.exitCode = 2;
}
