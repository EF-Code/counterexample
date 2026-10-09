import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { webApprovalSchema } from "../src/repair-web-contract.ts";
import { appUrl } from "./fixtures.ts";
import {
  enableRepairFixture,
  proposalFixture,
  repairToken,
  verificationFixture,
} from "./repair-fixtures.ts";

test("curated proposal requires review before verification and downloads explicit JSON", async ({
  page,
}) => {
  // Given mocked repair orchestration and the real fixture API.
  await enableRepairFixture(page);
  let approvals = 0;
  await page.route("**/api/repair/propose", (route) => route.fulfill({ json: proposalFixture }));
  await page.route("**/api/repair/verify", (route) => {
    const body: unknown = route.request().postDataJSON();
    expect(webApprovalSchema.parse(body)).toMatchObject({
      jobId: proposalFixture.jobId,
      proposalHash: proposalFixture.proposalHash,
      approved: true,
    });
    expect(route.request().headers()["x-counterexample-token"]).toBe(repairToken);
    approvals += 1;
    return route.fulfill({ json: verificationFixture });
  });
  await page.route("**/api/repair/artifacts/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: '{"formatVersion":1,"source":"reference","files":[]}',
    }),
  );
  await page.goto(appUrl());
  // When the user creates a proposal, reviews it, and explicitly approves execution.
  await page.getByRole("button", { name: "Try offline fixture" }).click();
  await page.getByRole("button", { name: "Create reference proposal" }).click();
  await expect(page.getByRole("button", { name: "Approve and verify in Docker" })).toBeDisabled();
  expect(approvals).toBe(0);
  await page.getByRole("checkbox", { name: "I reviewed this service.ts change" }).check();
  await page.getByRole("button", { name: "Approve and verify in Docker" }).click();
  // Then the result is shown only after approval and the bundle format is not misrepresented as ZIP.
  await expect(
    page.getByText("Candidate verified within fixture scope", { exact: true }),
  ).toBeVisible();
  expect(approvals).toBe(1);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download repair bundle (JSON)" }).click();
  expect((await pending).suggestedFilename()).toBe("repair-bundle.json");
});

for (const width of [375, 768, 1280]) {
  test(`repair review and results reflow at ${width}px`, async ({ page }, testInfo) => {
    // Given repair test data at a supported viewport.
    await page.setViewportSize({ width, height: 900 });
    await enableRepairFixture(page);
    await page.route("**/api/repair/propose", (route) => route.fulfill({ json: proposalFixture }));
    await page.route("**/api/repair/verify", (route) =>
      route.fulfill({ json: verificationFixture }),
    );
    await page.goto(appUrl());
    // When the reviewed proposal and verified result are displayed.
    await page.getByRole("button", { name: "Try offline fixture" }).click();
    await page.getByRole("button", { name: "Create reference proposal" }).click();
    await expect(page.getByRole("button", { name: "Approve and verify in Docker" })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: testInfo.outputPath(`repair-review-${width}.png`),
      fullPage: true,
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("checkbox", { name: "I reviewed this service.ts change" }).check();
    await page.getByRole("button", { name: "Approve and verify in Docker" }).click();
    await expect(
      page.getByText("Candidate verified within fixture scope", { exact: true }),
    ).toBeVisible();
    // Then layout and automated accessibility remain valid.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`repair-result-${width}.png`),
      fullPage: true,
    });
  });
}
