import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSubmissionPacket } from "../src/submission-packet.ts";

describe.runIf(process.env["COUNTEREXAMPLE_TEST_DOCKER"] === "true")(
  "reference packet rehearsal",
  () => {
    it("includes real container verification when sandbox rehearsal is explicitly requested", async () => {
      // Given a new packet directory and the reviewed authored fixture.
      const root = await mkdtemp(join(tmpdir(), "counterexample-packet-docker-"));
      const outputDirectory = join(root, "packet");
      try {
        // When the reference-only Docker rehearsal is requested.
        const manifest = await createSubmissionPacket({ outputDirectory, sandbox: true });
        // Then reference provenance and actual candidate acceptance are recorded, not live model proof.
        expect(manifest).toMatchObject({
          aiRequestsMade: 0,
          liveAiProofIncluded: false,
          sandbox: {
            status: "passed",
            baselineViolations: 285,
            candidateViolations: 0,
            regressionPassed: true,
          },
        });
        const report: unknown = JSON.parse(
          await readFile(join(outputDirectory, "candidate", "verification.json"), "utf8"),
        );
        expect(report).toMatchObject({
          accepted: true,
          source: "reference",
          originalFilesModified: false,
        });
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }, 30000);
  },
);
