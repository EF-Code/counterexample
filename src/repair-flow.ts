import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SandboxError } from "./docker-sandbox.ts";
import { assertNever } from "./domain.ts";
import type { InferenceConnection } from "./nebius.ts";
import { regressionSource } from "./regression-export.ts";
import type { RepairRecord } from "./repair-contract.ts";
import {
  applyRepair,
  candidatePasses,
  proposalSchema,
  RepairError,
  repairRecordSchema,
} from "./repair-contract.ts";
import { proposeRepair } from "./repair-model.ts";
import {
  readProject,
  readSource,
  reserveOutput,
  reviewedSnapshot,
  sha256,
  verifyRegression,
  verifySnapshot,
  writeSnapshot,
} from "./repair-snapshot.ts";

export type ProposalRequest = {
  readonly projectDirectory: string;
  readonly outputDirectory: string;
  readonly inference:
    | { readonly source: "reference" }
    | {
        readonly source: "nebius";
        readonly consentToSendSource: boolean;
        readonly connection: InferenceConnection;
      };
};
export type ApprovalRequest = {
  readonly proposalDirectory: string;
  readonly outputDirectory: string;
  readonly approved: boolean;
};

const reference = proposalSchema.parse({
  status: "proposal",
  operation: "replace_charge_key",
  file: "service.ts",
  replacementKey: "purchase:demo-001",
  rationale: "Reference-only proposal: reuse the purchase key after ambiguous payment responses.",
});

export async function createProposal(request: ProposalRequest): Promise<RepairRecord> {
  switch (request.inference.source) {
    case "reference":
      break;
    case "nebius":
      if (!request.inference.consentToSendSource) throw new RepairError("source_consent_required");
      break;
    default:
      return assertNever(request.inference);
  }
  const snapshot = await readProject(request.projectDirectory);
  applyRepair(snapshot.service, reference);
  const output = await reserveOutput(request.outputDirectory);
  await writeSnapshot(output, snapshot);
  const baseline = await verifySnapshot(snapshot);
  if (baseline.verification.captured.holds || !baseline.verification.capturedRepeatMatches) {
    throw new RepairError("baseline_not_reproducible");
  }
  let proposal = reference;
  let inference: RepairRecord["inference"] = null;
  switch (request.inference.source) {
    case "reference":
      break;
    case "nebius": {
      const result = await proposeRepair(
        { serviceSource: snapshot.service, captured: baseline.verification.captured },
        request.inference.connection,
      );
      switch (result.value.status) {
        case "proposal":
          proposal = result.value;
          break;
        case "abstain":
          throw new RepairError("model_abstained");
        default:
          return assertNever(result.value);
      }
      inference = {
        requestedModel: result.requestedModel,
        responseModel: result.responseModel,
        usage: result.usage,
      };
      break;
    }
    default:
      return assertNever(request.inference);
  }
  const record: RepairRecord = {
    formatVersion: 1,
    source: request.inference.source,
    proposal,
    imageId: baseline.imageId,
    hashes: {
      service: sha256(snapshot.service),
      adapter: sha256(snapshot.adapter),
      runtime: sha256(snapshot.runtime),
      verifier: sha256(snapshot.verifier),
    },
    baseline: baseline.verification,
    inference,
  };
  const candidate = applyRepair(snapshot.service, proposal);
  const before = (
    snapshot.service.endsWith("\n") ? snapshot.service.slice(0, -1) : snapshot.service
  ).split("\n");
  const after = (candidate.endsWith("\n") ? candidate.slice(0, -1) : candidate).split("\n");
  const diff = [
    "--- a/service.ts",
    "+++ b/service.ts",
    `@@ -1,${before.length} +1,${after.length} @@`,
    ...before.map((line) => `-${line}`),
    ...(snapshot.service.endsWith("\n") ? [] : ["\\ No newline at end of file"]),
    ...after.map((line) => `+${line}`),
    ...(candidate.endsWith("\n") ? [] : ["\\ No newline at end of file"]),
    "",
  ].join("\n");
  await writeFile(join(output, "proposal.json"), JSON.stringify(record, null, 2), {
    flag: "wx",
    mode: 0o600,
  });
  await writeFile(join(output, "change.diff"), diff, { flag: "wx", mode: 0o600 });
  return record;
}

export async function verifyProposal(request: ApprovalRequest) {
  if (!request.approved) throw new RepairError("approval_required");
  const body: unknown = JSON.parse(
    await readSource(join(request.proposalDirectory, "proposal.json")),
  );
  const record = repairRecordSchema.parse(body);
  const source = await reviewedSnapshot(request.proposalDirectory, record);
  const candidate = { ...source, service: applyRepair(source.service, record.proposal) };
  const output = await reserveOutput(request.outputDirectory);
  await writeSnapshot(output, candidate);
  await writeFile(join(output, "counterexample.runtime.ts"), candidate.runtime, {
    flag: "wx",
    mode: 0o600,
  });
  await writeFile(
    join(output, "counterexample.test.ts"),
    regressionSource("./counterexample.adapter.ts", ["charge_timeout", "retry"]),
    { flag: "wx", mode: 0o600 },
  );
  await writeFile(join(output, "package.json"), '{"type":"module","private":true}', {
    flag: "wx",
    mode: 0o600,
  });
  const result = await verifySnapshot(candidate, record.imageId);
  let regressionPassed = false;
  try {
    await verifyRegression(candidate, record.imageId);
    regressionPassed = true;
  } catch (error) {
    if (!(error instanceof SandboxError) || error.code !== "sandbox_execution_failed") throw error;
  }
  const report = {
    accepted: candidatePasses(result.verification) && regressionPassed,
    regressionPassed,
    imageId: result.imageId,
    verification: result.verification,
    source: record.source,
    originalFilesModified: false,
    scope: "single_purchase_fixture_bounded_verification",
  } as const;
  await writeFile(join(output, "verification.json"), JSON.stringify(report, null, 2), {
    flag: "wx",
    mode: 0o600,
  });
  return report;
}
