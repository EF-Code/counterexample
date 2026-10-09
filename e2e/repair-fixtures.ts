import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { replay } from "../src/engine.ts";
import { proposalSchema } from "../src/repair-contract.ts";
import { proposalViewSchema, verifiedViewSchema } from "../src/repair-web-contract.ts";

const actions = ["observe", "charge_timeout", "restart", "observe", "retry"] as const;
const source = await readFile(
  new URL("../examples/billing-service/service.ts", import.meta.url),
  "utf8",
);
export const repairToken = "a".repeat(64);
export const proposalFixture = proposalViewSchema.parse({
  jobId: "550e8400-e29b-41d4-a716-446655440000",
  proposalHash: "b".repeat(64),
  record: {
    formatVersion: 1,
    source: "reference",
    imageId: `sha256:${"c".repeat(64)}`,
    proposal: proposalSchema.parse({
      status: "proposal",
      operation: "replace_charge_key",
      file: "service.ts",
      replacementKey: "purchase:demo-001",
      rationale: "Reference test data: keep the purchase key stable across retries.",
    }),
    hashes: {
      service: "d".repeat(64),
      adapter: "d".repeat(64),
      runtime: "d".repeat(64),
      verifier: "d".repeat(64),
    },
    baseline: {
      captured: replay({ workflow: "vulnerable", actions }),
      capturedRepeatMatches: true,
      schedulesChecked: 780,
      violationsFound: 285,
      nonExercisedPaymentSchedules: 0,
    },
    inference: null,
  },
  before: source,
  after: source.replace("provider.charge(null)", 'provider.charge("purchase:demo-001")'),
  diff: '-provider.charge(null)\n+provider.charge("purchase:demo-001")',
});
export const verificationFixture = verifiedViewSchema.parse({
  accepted: true,
  regressionPassed: true,
  imageId: proposalFixture.record.imageId,
  source: "reference",
  originalFilesModified: false,
  scope: "single_purchase_fixture_bounded_verification",
  verification: {
    captured: replay({ workflow: "idempotent", actions }),
    capturedRepeatMatches: true,
    schedulesChecked: 780,
    violationsFound: 0,
    nonExercisedPaymentSchedules: 0,
  },
});
export async function enableRepairFixture(page: Page, liveAvailable = false) {
  await page.route("**/api/repair/session", (route) =>
    route.fulfill({ json: { enabled: true, liveAvailable, token: repairToken, limit: 5 } }),
  );
}
