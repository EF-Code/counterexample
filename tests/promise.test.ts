import { describe, expect, it } from "vitest";
import { envSchema } from "../src/config.ts";
import { interpretationRequestSchema, interpretationSchema } from "../src/promise.ts";

describe("interpretation contracts", () => {
  it("requires request consent when a promise would be sent to Nebius", () => {
    // Given a promise without consent to transmit it.
    const input = { promise: "Never charge twice for one purchase." };
    // When the input crosses the API contract.
    const result = interpretationRequestSchema.safeParse(input);
    // Then inference cannot proceed from that input.
    expect(result.success).toBe(false);
  });

  it("accepts abstention when the requested property is unsupported", () => {
    // Given an explicit unsupported response.
    const input = { status: "unsupported", reason: "Cancellation is outside this fixture." };
    // When the model output is parsed.
    const result = interpretationSchema.safeParse(input);
    // Then abstention remains a valid outcome.
    expect(result.success).toBe(true);
  });

  it("rejects an executable payload when model output includes additional fields", () => {
    // Given a valid-looking interpretation carrying unsolicited code.
    const input = {
      status: "supported",
      property: "at_most_one_charge_per_intent",
      scope: "single_purchase_intent",
      explanation: "One charge per purchase.",
      code: "execute arbitrary commands",
    };
    // When that output crosses the model boundary.
    const result = interpretationSchema.safeParse(input);
    // Then the strict schema rejects it.
    expect(result.success).toBe(false);
  });

  it("disables live inference when no environment opt-in is supplied", () => {
    // Given an empty environment.
    const input = {};
    // When startup configuration is parsed.
    const result = envSchema.parse(input);
    // Then paid inference is disabled by default.
    expect(result.ENABLE_LIVE_AI).toBe("false");
  });
});
