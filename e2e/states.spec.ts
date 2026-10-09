import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { appUrl, enableMockInference, supportedResult } from "./fixtures.ts";

for (const width of [375, 768, 1280]) {
  test(`review, pending, error and primitive states at ${width}px`, async ({ page }, testInfo) => {
    // Given mocked inference with controlled completion and a real local application.
    await page.setViewportSize({ width, height: 900 });
    await enableMockInference(page);
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/interpret", async (route) => {
      await gate;
      await route.fulfill({ json: supportedResult });
    });
    await page.goto(appUrl());
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: testInfo.outputPath(`empty-${width}.png`), fullPage: true });
    // When interpretation progresses through its user-visible states.
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Interpret with Nemotron" }).click();
    await expect(page.getByLabel("What must never happen?")).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath(`pending-${width}.png`), fullPage: true });
    if (release === undefined) throw new Error("Inference gate was not initialized");
    release();
    await expect(page.getByRole("button", { name: "Approve this meaning" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`review-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "Approve this meaning" }).click();
    await expect(page.getByRole("button", { name: "Run billing fixture" })).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`approved-${width}.png`), fullPage: true });
    await page.unroute("**/api/interpret");
    await page.route("**/api/interpret", (route) =>
      route.fulfill({ status: 502, json: { error: "invalid_response" } }),
    );
    await page.getByRole("button", { name: "Interpret with Nemotron" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`error-${width}.png`), fullPage: true });
    // Then every state preserves layout, focus and accessible recovery controls.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.goto(appUrl("/primitives.html"));
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("button", { name: "Run fixture", exact: true }).focus();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`primitives-${width}.png`), fullPage: true });
  });
}

test("model text stays inert and long CJK content does not overflow", async ({ page }) => {
  // Given model output containing HTML-like text and a long identifier.
  await enableMockInference(page);
  const explanation = `<img src=x onerror="window.injected=true"> ${"安全な購入約束を確認します。".repeat(20)}`;
  await page.route("**/api/interpret", (route) =>
    route.fulfill({
      json: {
        ...supportedResult,
        interpretation: { ...supportedResult.interpretation, explanation },
      },
    }),
  );
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(appUrl());
  // When the response is rendered on a narrow screen.
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Interpret with Nemotron" }).click();
  await expect(page.getByRole("button", { name: "Approve this meaning" })).toBeVisible();
  // Then model output is text, not executable markup, and the page stays within the viewport.
  await expect(page.locator("#review-content img")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
