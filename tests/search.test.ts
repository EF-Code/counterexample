import { describe, expect, it } from "vitest";
import { replay } from "../src/engine.ts";
import { explore, minimize } from "../src/search.ts";

describe("bounded counterexample search", () => {
  it("preserves the schedule when there is no violation to reduce", () => {
    // Given a passing reference schedule.
    const scenario = { workflow: "idempotent", actions: ["charge_timeout", "retry"] } as const;
    // When reduction is requested.
    const actions = minimize(scenario);
    // Then reduction does not fabricate a failing trace.
    expect(actions).toEqual(scenario.actions);
  });

  it("returns a deletion-minimal trace when a failing schedule is reduced", () => {
    // Given a restart-related duplicate-charge failure.
    const scenario = { workflow: "vulnerable", actions: ["charge", "restart", "retry"] } as const;
    // When reduction evaluates causal necessity.
    const actions = minimize(scenario);
    // Then removing any individual action makes the promise hold.
    expect(replay({ workflow: scenario.workflow, actions }).holds).toBe(false);
    expect(
      actions.every(
        (_, index) =>
          replay({
            workflow: scenario.workflow,
            actions: actions.filter((_, candidate) => candidate !== index),
          }).holds,
      ),
    ).toBe(true);
  });

  it("reduces a failing schedule when observations and restarts are irrelevant", () => {
    // Given a failing schedule with noise.
    const scenario = {
      workflow: "vulnerable",
      actions: ["observe", "charge_timeout", "observe", "restart", "retry"],
    } as const;
    // When deletion reduction runs.
    const actions = minimize(scenario);
    // Then only the two causally necessary actions remain.
    expect(actions).toEqual(["charge_timeout", "retry"]);
    expect(replay({ workflow: scenario.workflow, actions }).holds).toBe(false);
  });

  it("checks all bounded schedules when the reference implementation is explored", () => {
    // Given five actions and a depth-four bound.
    const bound = 4;
    // When the idempotent fixture is explored.
    const report = explore("idempotent", bound);
    // Then all 780 schedules pass without asserting unbounded correctness.
    expect(report).toMatchObject({
      schedulesChecked: 780,
      violationsFound: 0,
      counterexample: null,
    });
  });

  it("finds a replayable violation when the vulnerable fixture is explored", () => {
    // Given the vulnerable fixture.
    const workflow = "vulnerable";
    // When bounded search runs.
    const report = explore(workflow, 3);
    // Then a reproducible counterexample is returned.
    expect(report.schedulesChecked).toBe(155);
    expect(report.violationsFound).toBeGreaterThan(0);
    expect(report.counterexample?.replay.holds).toBe(false);
  });
});
