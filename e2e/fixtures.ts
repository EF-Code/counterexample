import type { Page } from "@playwright/test";
import type { InferenceResult } from "../src/promise.ts";

export const supportedResult: InferenceResult = {
  interpretation: {
    status: "supported",
    property: "at_most_one_charge_per_intent",
    scope: "single_purchase_intent",
    explanation:
      "One purchase may result in at most one successful charge, including timeout and retry.",
  },
  requestedModel: "nvidia/nemotron-3-super-120b-a12b",
  responseModel: "nvidia/nemotron-3-super-120b-a12b",
  reviewRequired: true,
  usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
};

export function appUrl(path = "/"): string {
  const base = process.env["CE_E2E_BASE_URL"];
  if (base === undefined) throw new Error("Browser test server was not started");
  return new URL(path, base).href;
}

export async function enableMockInference(page: Page) {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: {
        status: "ok",
        liveAiEnabled: true,
        apiKeyConfigured: true,
        model: supportedResult.requestedModel,
      },
    }),
  );
}
