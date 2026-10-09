import { defineConfig } from "@playwright/test";

const executablePath = process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"];
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/setup.ts",
  outputDir: "./artifacts/browser-results",
  reporter: [["list"], ["html", { outputFolder: "artifacts/playwright-report", open: "never" }]],
  fullyParallel: true,
  workers: 2,
  use: {
    browserName: "chromium",
    channel: "chromium",
    launchOptions: executablePath === undefined ? {} : { executablePath },
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
});
