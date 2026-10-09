import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { candidatePasses } from "../src/repair-contract.ts";
import { createProposal, verifyProposal } from "../src/repair-flow.ts";
import { readProject, sha256, verifySnapshot } from "../src/repair-snapshot.ts";

const projectDirectory = fileURLToPath(new URL("../examples/billing-service/", import.meta.url));
describe.runIf(process.env["COUNTEREXAMPLE_TEST_DOCKER"] === "true")(
  "container-verified repair flow",
  () => {
    it("rejects substituted verifier code even when the artifact hash was rewritten", async () => {
      // Given a proposal whose verifier and claimed hash were replaced together.
      const directory = await mkdtemp(join(tmpdir(), "counterexample-verifier-"));
      const proposalDirectory = join(directory, "proposal");
      try {
        const record = await createProposal({
          projectDirectory,
          outputDirectory: proposalDirectory,
          inference: { source: "reference" },
        });
        const substituted = "process.stdout.write('forged verification');";
        await writeFile(join(proposalDirectory, "verifier.ts"), substituted);
        await writeFile(
          join(proposalDirectory, "proposal.json"),
          JSON.stringify({
            ...record,
            hashes: { ...record.hashes, verifier: sha256(substituted) },
          }),
        );
        // When the altered artifact is approved.
        const result = verifyProposal({
          proposalDirectory,
          outputDirectory: join(directory, "candidate"),
          approved: true,
        });
        // Then verifier/runtime identity is anchored to Counterexample's own tools.
        await expect(result).rejects.toMatchObject({ code: "verification_tools_mismatch" });
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }, 30000);
    it("verifies the correction without changing originals when an explicit proposal is approved", async () => {
      // Given the authored buggy project and separate proposal/candidate outputs.
      const directory = await mkdtemp(join(tmpdir(), "counterexample-repair-"));
      const proposalDirectory = join(directory, "proposal");
      const original = await readFile(join(projectDirectory, "service.ts"), "utf8");
      try {
        // When a labeled reference proposal is reviewed and explicitly approved.
        const record = await createProposal({
          projectDirectory,
          outputDirectory: proposalDirectory,
          inference: { source: "reference" },
        });
        const result = await verifyProposal({
          proposalDirectory,
          outputDirectory: join(directory, "candidate"),
          approved: true,
        });
        // Then actual container execution fixes the trace and all bounded schedules, without modifying the project.
        expect(record).toMatchObject({
          source: "reference",
          baseline: { captured: { holds: false, successfulCharges: 2 }, violationsFound: 285 },
        });
        expect(result).toMatchObject({
          accepted: true,
          regressionPassed: true,
          verification: {
            captured: { successfulCharges: 1 },
            violationsFound: 0,
            schedulesChecked: 780,
          },
        });
        expect(await readFile(join(projectDirectory, "service.ts"), "utf8")).toBe(original);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }, 30000);

    it("refuses verification when approval was not granted", async () => {
      // Given an unapproved proposal location.
      const request = {
        proposalDirectory: "/unused-proposal",
        outputDirectory: "/unused-output",
        approved: false,
      };
      // When verification is requested.
      const result = verifyProposal(request);
      // Then approval is checked before any filesystem or container operation.
      await expect(result).rejects.toMatchObject({ code: "approval_required" });
    });

    it("rejects a changed snapshot when approval no longer matches reviewed source", async () => {
      // Given a proposed source snapshot.
      const directory = await mkdtemp(join(tmpdir(), "counterexample-tamper-"));
      const proposalDirectory = join(directory, "proposal");
      try {
        await createProposal({
          projectDirectory,
          outputDirectory: proposalDirectory,
          inference: { source: "reference" },
        });
        await writeFile(join(proposalDirectory, "service.ts"), "source changed after review");
        // When the altered snapshot is approved for verification.
        const result = verifyProposal({
          proposalDirectory,
          outputDirectory: join(directory, "candidate"),
          approved: true,
        });
        // Then hash mismatch prevents candidate execution.
        await expect(result).rejects.toMatchObject({ code: "snapshot_hash_mismatch" });
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }, 30000);

    it("rejects disabled billing when a no-op candidate is executed in Docker", async () => {
      // Given a candidate that does not exercise the committing gateway.
      const snapshot = await readProject(projectDirectory);
      // When the actual verifier runs the no-op implementation.
      const result = await verifySnapshot({
        ...snapshot,
        service: "export function createBillingService() { return {attempt() {}}; }",
      });
      // Then a vacuous property pass is not accepted as a correction.
      expect(candidatePasses(result.verification)).toBe(false);
      expect(result.verification.nonExercisedPaymentSchedules).toBe(750);
    }, 30000);
  },
);
