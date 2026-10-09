import { runBillingSchedule } from "./billing-runtime.ts";
import { builtinWorkflow } from "./builtin-workflows.ts";
import type { Replay, Scenario } from "./domain.ts";

export function replay(scenario: Scenario): Replay {
  return {
    ...runBillingSchedule(builtinWorkflow(scenario.workflow), scenario.actions),
    workflow: scenario.workflow,
  };
}
