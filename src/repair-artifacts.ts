import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assertNever } from "./domain.ts";
import type { RepairJob } from "./repair-job-store.ts";
import type { RepairArtifact } from "./repair-web-contract.ts";
import { RepairWebError } from "./repair-web-contract.ts";

export async function repairArtifact(job: RepairJob, name: RepairArtifact): Promise<string> {
  switch (name) {
    case "proposal.json":
    case "change.diff":
      return readFile(join(job.root, "proposal", name), "utf8");
    case "verification.json":
      if (job.phase !== "complete") throw new RepairWebError("repair_artifact_unavailable", 409);
      return readFile(join(job.root, "candidate", name), "utf8");
    case "repair-bundle.json": {
      if (job.phase !== "complete") throw new RepairWebError("repair_artifact_unavailable", 409);
      const names = [
        "service.ts",
        "counterexample.adapter.ts",
        "counterexample.runtime.ts",
        "counterexample.test.ts",
        "package.json",
        "verification.json",
      ] as const;
      const files = await Promise.all(
        names.map(async (file) => ({
          name: file,
          content: await readFile(join(job.root, "candidate", file), "utf8"),
        })),
      );
      return JSON.stringify(
        {
          formatVersion: 1,
          source: job.proposal.record.source,
          scope: job.result.scope,
          files,
          instructions:
            "Review and extract these files into a new directory. Node 24+: node --test counterexample.test.ts. Running outside Docker uses normal host privileges.",
        },
        null,
        2,
      );
    }
    default:
      return assertNever(name);
  }
}
