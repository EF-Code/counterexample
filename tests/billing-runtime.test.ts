import { describe, expect, it } from "vitest";
import type { WorkflowFactory } from "../src/billing-runtime.ts";
import {
  adaptBillingModule,
  reduceBillingSchedule,
  runBillingSchedule,
} from "../src/billing-runtime.ts";

const vulnerable: WorkflowFactory = (provider) => {
  let confirmed = false;
  return {
    attempt: () => {
      if (confirmed) return;
      confirmed = provider.charge(null) === "acknowledged";
    },
  };
};
const fixed: WorkflowFactory = (provider) => {
  let confirmed = false;
  return {
    attempt: () => {
      if (confirmed) return;
      confirmed = provider.charge("purchase:one") === "acknowledged";
    },
  };
};

describe("provider-driven billing runtime", () => {
  it("preserves method state when an adapter uses this rather than closure variables", () => {
    // Given a worker whose acknowledgement lives on the returned object.
    const imported = {
      createWorkflow: (provider: Parameters<WorkflowFactory>[0]) => ({
        confirmed: false,
        attempt() {
          if (this.confirmed) return;
          this.confirmed = provider.charge(null) === "acknowledged";
        },
      }),
    };
    // When the module is adapted and its happy path is replayed.
    const result = runBillingSchedule(adaptBillingModule(imported), ["charge", "retry"]);
    // Then method binding preserves acknowledgement and prevents a duplicate.
    expect(result).toMatchObject({ holds: true, successfulCharges: 1 });
  });

  it("rejects asynchronous attempts when they would escape deterministic observation", () => {
    // Given an adapter returning an asynchronous attempt.
    const imported = { createWorkflow: () => ({ attempt: async () => undefined }) };
    // When it executes under the synchronous adapter contract.
    const execute = () => runBillingSchedule(adaptBillingModule(imported), ["charge"]);
    // Then a pending promise cannot be mistaken for completed execution.
    expect(execute).toThrow("adapter_contract_invalid");
  });

  it("exposes a duplicate charge when repository code retries without a stable key", () => {
    // Given actual workflow code using the supplied provider.
    const actions = ["charge_timeout", "retry"] as const;
    // When the ambiguous payment is retried.
    const result = runBillingSchedule(vulnerable, actions);
    // Then provider-observed charges violate the promise.
    expect(result).toMatchObject({ holds: false, successfulCharges: 2, chargedCents: 5000 });
  });

  it("preserves provider records when a fixed workflow restarts", () => {
    // Given a stable purchase key and a fresh worker after restart.
    const actions = ["charge_timeout", "restart", "retry"] as const;
    // When repository code is replayed.
    const result = runBillingSchedule(fixed, actions);
    // Then only one charge is committed.
    expect(result).toMatchObject({ holds: true, successfulCharges: 1 });
    expect(result.trace[2]).toMatchObject({ outcome: "deduplicated", response: "acknowledged" });
  });

  it("reduces a repository failure when observations are irrelevant", () => {
    // Given a failing schedule containing observations and a restart.
    const actions = ["observe", "charge_timeout", "restart", "observe", "retry"] as const;
    // When the adapter is rerun under candidate reductions.
    const reduced = reduceBillingSchedule(vulnerable, actions);
    // Then the causal two-action failure remains.
    expect(reduced).toEqual(["charge_timeout", "retry"]);
  });

  it("passes the happy path when local acknowledgement prevents another request", () => {
    // Given an acknowledged purchase.
    const actions = ["charge", "retry"] as const;
    // When the same worker retries.
    const result = runBillingSchedule(vulnerable, actions);
    // Then the worker makes no second provider call.
    expect(result).toMatchObject({ holds: true, successfulCharges: 1 });
    expect(result.trace[1]?.outcome).toBe("already_confirmed");
  });

  it("enforces a request budget when an adapter repeatedly calls the provider", () => {
    // Given a workflow that exceeds the bounded provider budget.
    const factory: WorkflowFactory = (provider) => ({
      attempt: () => {
        for (let index = 0; index < 101; index += 1) provider.charge(null);
      },
    });
    // When its attempt is executed.
    const execute = () => runBillingSchedule(factory, ["charge"]);
    // Then execution stops rather than producing an unbounded trace.
    expect(execute).toThrow("provider_call_budget_exceeded");
  });
});
