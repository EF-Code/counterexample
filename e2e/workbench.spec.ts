import { readFile } from "node:fs/promises";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { appUrl, enableMockInference, supportedResult } from "./fixtures.ts";

test("offline evidence can be inspected and downloaded without inference", async ({ page }) => {
  // Given a live local API with inference disabled.
  let inferenceRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/interpret")) inferenceRequests += 1;
  });
  await page.goto(appUrl());
  // When the user runs the labeled offline fixture.
  await page.getByRole("button", { name: "Try offline fixture" }).click();
  // Then real backend evidence and its provenance are visible.
  await expect(page.getByText("Offline fixture · no AI call")).toBeVisible();
  await expect(page.getByText("$50.00", { exact: true })).toBeVisible();
  await expect(page.getByText("$25.00", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Executed event sequence" }).locator("li"),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Full trace", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Executed event sequence" }).locator("li"),
  ).toHaveCount(5);
  const pendingDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download evidence" }).click();
  const download = await pendingDownload;
  const path = await download.path();
  if (path === null) throw new Error("Evidence download has no local artifact");
  const evidence: unknown = JSON.parse(await readFile(path, "utf8"));
  expect(evidence).toMatchObject({
    approval: { source: "fixture" },
    evidence: { before: { holds: false } },
  });
  expect(inferenceRequests).toBe(0);
});

test("live interpretation requires consent and approval and edits invalidate evidence", async ({
  page,
}) => {
  // Given a mocked inference response and the real deterministic API.
  await enableMockInference(page);
  let inferenceRequests = 0;
  await page.route("**/api/interpret", (route) => {
    inferenceRequests += 1;
    return route.fulfill({ json: supportedResult });
  });
  await page.goto(appUrl());
  // When the user submits and approves the interpretation.
  await expect(page.getByRole("button", { name: "Interpret with Nemotron" })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Interpret with Nemotron" }).click();
  await expect(page.getByRole("button", { name: "Run billing fixture" })).toHaveCount(0);
  await page.getByRole("button", { name: "Approve this meaning" }).click();
  await page.getByRole("button", { name: "Run billing fixture" }).click();
  // Then execution occurs only after approval, and editing clears the result.
  await expect(page.getByText("$50.00", { exact: true })).toBeVisible();
  expect(inferenceRequests).toBe(1);
  await page
    .getByLabel("What must never happen?")
    .fill("Refund every customer within ten minutes.");
  await expect(page.getByRole("button", { name: "Run billing fixture" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download evidence" })).toHaveCount(0);
});

test("unsupported meaning and upstream failure stop execution", async ({ page }) => {
  // Given an unsupported model response.
  await enableMockInference(page);
  await page.route("**/api/interpret", (route) =>
    route.fulfill({
      json: {
        ...supportedResult,
        interpretation: { status: "unsupported", reason: "Cancellation is not supported." },
      },
    }),
  );
  await page.goto(appUrl());
  // When the user requests interpretation.
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Interpret with Nemotron" }).click();
  // Then abstention has no approval path.
  await expect(page.getByText("Outside supported scope")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve this meaning" })).toHaveCount(0);
  await page.unroute("**/api/interpret");
  await page.route("**/api/interpret", (route) =>
    route.fulfill({ status: 502, json: { error: "upstream_unavailable" } }),
  );
  await page.getByRole("button", { name: "Interpret with Nemotron" }).click();
  await expect(page.getByRole("alert")).toContainText("Nebius inference is unavailable");
  await page.getByRole("button", { name: "Try offline fixture" }).click();
  await expect(page.getByText("$50.00", { exact: true })).toBeVisible();
});

for (const width of [375, 768, 1280]) {
  test(`fixture is accessible and reflows at ${width}px`, async ({ page }, testInfo) => {
    // Given a viewport using the shipped production assets.
    await page.setViewportSize({ width, height: 900 });
    await page.goto(appUrl());
    // When real fixture evidence is displayed.
    await page.getByRole("button", { name: "Try offline fixture" }).click();
    await expect(page.getByText("$50.00", { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    // Then the page has no horizontal overflow or automated accessibility violations.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`fixture-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "Full trace", exact: true }).click();
    await page.getByRole("button", { name: "Full trace", exact: true }).hover();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`full-trace-${width}.png`), fullPage: true });
  });
}
