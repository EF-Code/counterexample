import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { webProposalRequestSchema } from "../src/repair-web-contract.ts";

test("repair availability failure stays visible after the fixture unlocks", async ({
  page,
}, testInfo) => {
  // Given a failed session-availability request before the base fixture runs.
  await page.route("**/api/repair/session", (route) =>
    route.fulfill({ status: 500, json: { error: "repair_operation_failed" } }),
  );
  const response = page.waitForResponse("**/api/repair/session");
  await page.goto(appUrl());
  await page.getByRole("button", { name: "Try offline fixture" }).click();
  await (await response).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  // When the user unlocks the curated repair panel.
  await page.getByRole("button", { name: "Try offline fixture" }).click();
  // Then failure is visible instead of a permanent loading message.
  await expect(page.locator("#repair-content")).toContainText("The repair operation failed");
  await page.screenshot({
    path: testInfo.outputPath("repair-availability-error-1280.png"),
    fullPage: true,
  });
  await page.unroute("**/api/repair/session");
  await enableRepairFixture(page);
  await page.getByRole("button", { name: "Reload repair availability" }).click();
  await expect(page.getByRole("button", { name: "Create reference proposal" })).toBeVisible();
});

import { appUrl } from "./fixtures.ts";
import { enableRepairFixture, proposalFixture } from "./repair-fixtures.ts";

test("live repair source transmission requires its own consent", async ({ page }) => {
  // Given an enabled live-capable repair session without source consent.
  await enableRepairFixture(page, true);
  let requests = 0;
  await page.route("**/api/repair/propose", (route) => {
    const body: unknown = route.request().postDataJSON();
    expect(webProposalRequestSchema.parse(body)).toEqual({
      mode: "nebius",
      consentToSendSource: true,
    });
    requests += 1;
    return route.fulfill({ json: proposalFixture });
  });
  await page.goto(appUrl());
  // When the user selects live proposals and separately consents to source sharing.
  await page.getByRole("button", { name: "Try offline fixture" }).click();
  await page.getByLabel("Proposal source").selectOption("nebius");
  await expect(page.getByRole("button", { name: "Request Nemotron proposal" })).toBeDisabled();
  expect(requests).toBe(0);
  await page.getByRole("checkbox", { name: "Send only the curated example source" }).check();
  await page.getByRole("button", { name: "Request Nemotron proposal" }).click();
  // Then the explicit transmission request does not automatically approve a candidate.
  await expect(page.getByRole("button", { name: "Approve and verify in Docker" })).toBeDisabled();
  expect(requests).toBe(1);
});

test("late repair responses cannot restore approval after promise editing", async ({ page }) => {
  // Given a pending repair response.
  await enableRepairFixture(page);
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/repair/propose", async (route) => {
    await gate;
    await route.fulfill({ json: proposalFixture });
  });
  await page.goto(appUrl());
  await page.getByRole("button", { name: "Try offline fixture" }).click();
  await page.getByRole("button", { name: "Create reference proposal" }).click();
  // When the base promise changes before that response arrives.
  await expect(page.getByText("Building proposal and reproducing baseline…")).toBeVisible();
  await page
    .getByLabel("What must never happen?")
    .fill("A different promise that has not been approved.");
  const completed = page.waitForResponse("**/api/repair/propose");
  if (release === undefined) throw new Error("Pending response gate missing");
  release();
  await (await completed).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  // Then no stale proposal approval or candidate execution control reappears.
  await expect(page.getByRole("button", { name: "Approve and verify in Docker" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create reference proposal" })).toHaveCount(0);
});

for (const width of [375, 768, 1280]) {
  test(`repair ready, pending and recovery states at ${width}px`, async ({ page }, testInfo) => {
    // Given controlled pending responses at a supported viewport.
    await page.setViewportSize({ width, height: 900 });
    await enableRepairFixture(page);
    let releaseProposal: (() => void) | undefined;
    let releaseVerification: (() => void) | undefined;
    const proposalGate = new Promise<void>((resolve) => {
      releaseProposal = resolve;
    });
    const verificationGate = new Promise<void>((resolve) => {
      releaseVerification = resolve;
    });
    await page.route("**/api/repair/propose", async (route) => {
      await proposalGate;
      await route.fulfill({ json: proposalFixture });
    });
    await page.route("**/api/repair/verify", async (route) => {
      await verificationGate;
      await route.fulfill({ status: 502, json: { error: "sandbox_image_unavailable" } });
    });
    await page.goto(appUrl());
    await page.getByRole("button", { name: "Try offline fixture" }).click();
    await expect(page.getByRole("button", { name: "Create reference proposal" })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: testInfo.outputPath(`repair-ready-${width}.png`),
      fullPage: true,
    });
    // When proposal and candidate verification progress through pending states.
    await page.getByRole("button", { name: "Create reference proposal" }).click();
    await expect(page.getByText("Building proposal and reproducing baseline…")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`repair-proposing-${width}.png`),
      fullPage: true,
    });
    if (releaseProposal === undefined || releaseVerification === undefined)
      throw new Error("Pending response gates missing");
    releaseProposal();
    await page.getByRole("checkbox", { name: "I reviewed this service.ts change" }).check();
    await page.getByRole("button", { name: "Approve and verify in Docker" }).click();
    await expect(page.getByText("Verifying candidate in Docker…")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`repair-verifying-${width}.png`),
      fullPage: true,
    });
    releaseVerification();
    await expect(page.getByRole("alert")).toContainText(
      "Docker or the pinned Node image is unavailable",
    );
    // Then an accessible recovery state replaces any acceptance claim.
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`repair-error-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Start a new proposal" }).click();
    await expect(page.getByRole("button", { name: "Create reference proposal" })).toBeVisible();
  });
}
