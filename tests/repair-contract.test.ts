import { describe, expect, it } from "vitest";
import { replay } from "../src/engine.ts";
import {
  applyRepair,
  candidatePasses,
  proposalSchema,
  repairResponseSchema,
} from "../src/repair-contract.ts";

const proposal = proposalSchema.parse({
  status: "proposal",
  operation: "replace_charge_key",
  file: "service.ts",
  replacementKey: "purchase:demo-001",
  rationale: "Keep a stable key across retries.",
});

describe("restricted repair contract", () => {
  it("changes only the charge key when the supported expression occurs once", () => {
    // Given a source file with the narrow supported billing operation.
    const source = "const response = provider.charge(null);";
    // When the proposal is applied to a copy.
    const candidate = applyRepair(source, proposal);
    // Then only a quoted stable key replaces null.
    expect(candidate).toBe('const response = provider.charge("purchase:demo-001");');
  });

  it.each(["provider.charge(existingKey)", "provider.charge(null); provider.charge(null);"])(
    "refuses a patch when its source anchor is missing or ambiguous",
    (source) => {
      // Given a source outside the single-anchor repair profile.
      const input = source;
      // When a repair is attempted.
      const execute = () => applyRepair(input, proposal);
      // Then no broad replacement is inferred.
      expect(execute).toThrow("unsupported_repair_source");
    },
  );

  it("rejects executable fields when model output exceeds the allowed operation", () => {
    // Given model output containing an unsolicited command.
    const input = { ...proposal, command: "execute arbitrary code" };
    // When the response crosses the model boundary.
    const result = repairResponseSchema.safeParse(input);
    // Then it is rejected rather than executed.
    expect(result.success).toBe(false);
  });

  it("accepts verified correction when the trace and additional schedules pass", () => {
    // Given a captured trace passing with one committed purchase and clean bounded exploration.
    const result = {
      captured: replay({ workflow: "idempotent", actions: ["charge_timeout", "retry"] }),
      capturedRepeatMatches: true,
      schedulesChecked: 780,
      violationsFound: 0,
      nonExercisedPaymentSchedules: 0,
    } as const;
    // When acceptance is decided deterministically.
    const accepted = candidatePasses(result);
    // Then the correction is accepted without an LLM judge.
    expect(accepted).toBe(true);
  });

  it("rejects disabled billing when no purchase is exercised", () => {
    // Given an adapter with zero committed charges despite a payment schedule.
    const captured = { ...replay({ workflow: "idempotent", actions: [] }), holds: true };
    // When candidate acceptance is evaluated.
    const accepted = candidatePasses({
      captured,
      capturedRepeatMatches: true,
      schedulesChecked: 780,
      violationsFound: 0,
      nonExercisedPaymentSchedules: 750,
    });
    // Then avoiding payment is not accepted as a repair.
    expect(accepted).toBe(false);
  });
});
