import { parseArgs } from "node:util";
import { z } from "zod";
import { envSchema } from "./config.ts";
import { SandboxError } from "./docker-sandbox.ts";
import { assertNever } from "./domain.ts";
import { InferenceError } from "./nebius.ts";
import { RepairError } from "./repair-contract.ts";
import { createProposal, verifyProposal } from "./repair-flow.ts";

async function main() {
  const { values, positionals } = parseArgs({
    strict: true,
    allowPositionals: true,
    options: {
      project: { type: "string" },
      proposal: { type: "string" },
      output: { type: "string" },
      live: { type: "boolean", default: false },
      "consent-send-source": { type: "boolean", default: false },
      approve: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    process.stdout.write(
      [
        "Counterexample scoped repair workflow",
        "",
        "repair propose --project examples/billing-service --output NEW_DIRECTORY [--live --consent-send-source]",
        "repair verify --proposal PROPOSAL_DIRECTORY --output NEW_DIRECTORY --approve",
        "",
        "Default proposals are labeled reference data, not AI-generated.",
        "Live mode requires ENABLE_LIVE_AI=true and NEBIUS_API_KEY on the host.",
        "Review proposal.json and change.diff before granting approval.",
        "Execution uses a restricted Docker container; original files are never patched.",
        "Requires an existing local node:24-alpine image. Containers share the host kernel.",
        "",
      ].join("\n"),
    );
    return;
  }
  const command = z
    .array(z.enum(["propose", "verify"]))
    .length(1)
    .parse(positionals)[0];
  if (command === undefined) throw new RepairError("invalid_arguments");
  const outputDirectory = z.string().min(1).parse(values.output);
  switch (command) {
    case "propose": {
      if (values.live && !values["consent-send-source"])
        throw new RepairError("source_consent_required");
      const config = envSchema.parse(process.env);
      if (values.live && config.ENABLE_LIVE_AI !== "true")
        throw new RepairError("live_ai_disabled");
      if (values.live && !config.NEBIUS_API_KEY) throw new RepairError("api_key_missing");
      const projectDirectory = z.string().min(1).parse(values.project);
      const inference =
        values.live && config.NEBIUS_API_KEY
          ? ({
              source: "nebius",
              consentToSendSource: true,
              connection: {
                apiKey: config.NEBIUS_API_KEY,
                model: config.NEBIUS_MODEL,
                endpoint: "https://api.tokenfactory.nebius.com/v1/chat/completions",
              },
            } as const)
          : ({ source: "reference" } as const);
      const record = await createProposal({ projectDirectory, outputDirectory, inference });
      process.stdout.write(
        `${JSON.stringify({ reviewRequired: true, outputDirectory, record }, null, 2)}\n`,
      );
      return;
    }
    case "verify": {
      if (!values.approve) throw new RepairError("approval_required");
      const proposalDirectory = z.string().min(1).parse(values.proposal);
      const report = await verifyProposal({ proposalDirectory, outputDirectory, approved: true });
      process.stdout.write(`${JSON.stringify({ outputDirectory, report }, null, 2)}\n`);
      if (!report.accepted) process.exitCode = 1;
      return;
    }
    default:
      return assertNever(command);
  }
}

try {
  await main();
} catch (error) {
  if (
    error instanceof RepairError ||
    error instanceof SandboxError ||
    error instanceof InferenceError
  ) {
    process.stderr.write(`${error.code}\n`);
  } else if (error instanceof z.ZodError || error instanceof TypeError)
    process.stderr.write("invalid_arguments\n");
  else if (error instanceof Error) process.stderr.write("repair_operation_failed\n");
  else process.stderr.write("repair_operation_failed\n");
  process.exitCode = 2;
}
