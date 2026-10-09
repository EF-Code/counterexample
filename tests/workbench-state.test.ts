import { describe, expect, it } from "vitest";
import type { InferenceResult } from "../src/promise.ts";
import { approve, canRun, edit, fixtureSession } from "../web/state.ts";

const supported: InferenceResult = {
  interpretation: {
    status: "supported",
    property: "at_most_one_charge_per_intent",
    scope: "single_purchase_intent",
    explanation: "One successful charge per purchase.",
  },
  requestedModel: "nvidia/nemotron-3-super-120b-a12b",
  responseModel: "nvidia/nemotron-3-super-120b-a12b",
  reviewRequired: true,
  usage: null,
};

describe("workbench approval gate", () => {
  it("permits execution when a supported interpretation is explicitly approved", () => {
    // Given a supported interpretation awaiting human review.
    const session = {
      phase: "review",
      promise: "One charge per purchase.",
      result: supported,
    } as const;
    // When the user explicitly approves it.
    const result = approve(session);
    // Then only the approved state can run.
    expect(canRun(result)).toBe(true);
    expect(result.phase).toBe("approved");
  });

  it("prevents execution when the interpretation is unsupported", () => {
    // Given an unsupported interpretation.
    const session = {
      phase: "review",
      promise: "Never charge after cancellation.",
      result: {
        ...supported,
        interpretation: { status: "unsupported", reason: "Outside fixture scope." },
      },
    } as const;
    // When approval is attempted.
    const result = approve(session);
    // Then no execution permission is granted.
    expect(canRun(result)).toBe(false);
  });

  it("invalidates approval when the promise text changes", () => {
    // Given an approved fixture session.
    const session = fixtureSession();
    // When its promise is edited to a different guarantee.
    const result = edit(session, "Refund within ten minutes.");
    // Then prior approval cannot authorize the new promise.
    expect(result).toEqual({ phase: "draft", promise: "Refund within ten minutes." });
    expect(canRun(result)).toBe(false);
  });

  it("labels fixture approval when no model call was made", () => {
    // Given an offline demonstration request.
    const create = fixtureSession;
    // When the fixture session is created.
    const result = create();
    // Then provenance cannot claim live model interpretation.
    expect(result).toMatchObject({ phase: "approved", approval: { source: "fixture" } });
  });
});
