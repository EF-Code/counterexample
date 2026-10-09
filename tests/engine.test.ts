import { describe, expect, it } from "vitest";
import { replay } from "../src/engine.ts";

describe("billing promise replay", () => {
  it("violates the promise when a committed payment times out and is retried", () => {
    // Given a vulnerable workflow and an ambiguous payment result.
    const scenario = { workflow: "vulnerable", actions: ["charge_timeout", "retry"] } as const;
    // When the same purchase is retried.
    const result = replay(scenario);
    // Then two charges violate the one-charge promise.
    expect(result).toMatchObject({ holds: false, successfulCharges: 2, chargedCents: 5000 });
  });

  it("preserves the promise when an idempotent payment times out and is retried", () => {
    // Given a provider-level stable purchase key.
    const scenario = { workflow: "idempotent", actions: ["charge_timeout", "retry"] } as const;
    // When the ambiguous request is retried.
    const result = replay(scenario);
    // Then the provider records only one charge.
    expect(result).toMatchObject({ holds: true, successfulCharges: 1, chargedCents: 2500 });
  });

  it("passes happy-path tests when the vulnerable workflow receives an acknowledgement", () => {
    // Given a completed payment in the same worker.
    const scenario = { workflow: "vulnerable", actions: ["charge", "retry"] } as const;
    // When replay runs without faults.
    const result = replay(scenario);
    // Then local acknowledgement prevents another charge.
    expect(result).toMatchObject({ holds: true, successfulCharges: 1 });
  });

  it("deduplicates after restart when the reference workflow loses local state", () => {
    // Given a stable purchase key and a worker restart.
    const scenario = { workflow: "idempotent", actions: ["charge", "restart", "retry"] } as const;
    // When a new worker retries the purchase.
    const result = replay(scenario);
    // Then durable provider state still prevents duplicate charges.
    expect(result).toMatchObject({ holds: true, successfulCharges: 1 });
  });

  it("produces identical traces when the same schedule is replayed", () => {
    // Given a fixed schedule with observation and restart noise.
    const scenario = {
      workflow: "vulnerable",
      actions: ["observe", "charge_timeout", "restart", "retry"],
    } as const;
    // When the schedule is executed twice.
    const pair = [replay(scenario), replay(scenario)];
    // Then results are deterministic and observation contains no charge.
    expect(pair[0]).toEqual(pair[1]);
    expect(pair[0]?.trace[0]).toMatchObject({ outcome: "observed", successfulCharges: 0 });
  });
});
