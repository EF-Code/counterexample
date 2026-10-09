import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createSubmissionPacket, packetManifestSchema } from "../src/submission-packet.ts";

describe("fixture-only submission evidence", () => {
  it("exports bounded evidence without claiming live AI or test execution", async () => {
    // Given a fresh output path and a dummy credential that must not enter the packet.
    const root = await mkdtemp(join(tmpdir(), "counterexample-packet-"));
    const outputDirectory = join(root, "packet");
    vi.stubEnv("NEBIUS_API_KEY", "test-only-packet-sentinel");
    try {
      // When the non-Docker evidence packet is generated.
      const manifest = await createSubmissionPacket({ outputDirectory, sandbox: false });
      // Then scope, provenance, actual fixture measurements and exclusions are explicit.
      expect(manifest).toMatchObject({
        scope: "authored_single_purchase_fixture",
        aiRequestsMade: 0,
        liveAiProofIncluded: false,
        automatedTestResults: "not_run_by_packet_generator",
        sandbox: { status: "not_run" },
      });
      expect((await readdir(outputDirectory)).sort()).toEqual([
        "RUNBOOK.md",
        "evidence.json",
        "manifest.json",
      ]);
      const evidence: unknown = JSON.parse(
        await readFile(join(outputDirectory, "evidence.json"), "utf8"),
      );
      expect(evidence).toMatchObject({
        before: { successfulCharges: 2 },
        referenceControl: { successfulCharges: 1 },
        exploration: {
          vulnerable: { schedulesChecked: 780, violationsFound: 285 },
          idempotent: { violationsFound: 0 },
        },
      });
      for (const file of ["manifest.json", "evidence.json", "RUNBOOK.md"]) {
        expect(await readFile(join(outputDirectory, file), "utf8")).not.toContain(
          "test-only-packet-sentinel",
        );
      }
      expect(
        packetManifestSchema.parse(
          JSON.parse(await readFile(join(outputDirectory, "manifest.json"), "utf8")),
        ),
      ).toEqual(manifest);
    } finally {
      vi.unstubAllEnvs();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refuses an existing output directory rather than overwriting files", async () => {
    // Given a directory containing a user-owned file.
    const root = await mkdtemp(join(tmpdir(), "counterexample-packet-existing-"));
    await writeFile(join(root, "keep.txt"), "keep");
    try {
      // When packet creation targets that directory.
      const result = createSubmissionPacket({ outputDirectory: root, sandbox: false });
      // Then existing data remains untouched.
      await expect(result).rejects.toMatchObject({ code: "output_directory_exists" });
      expect(await readFile(join(root, "keep.txt"), "utf8")).toBe("keep");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
