import { z } from "zod";
import type { Action, Replay, Scenario, Workflow } from "./domain.ts";
import { actionSchema } from "./domain.ts";
import { replay } from "./engine.ts";

export type SearchReport = {
  readonly workflow: Workflow;
  readonly maxDepth: number;
  readonly schedulesChecked: number;
  readonly violationsFound: number;
  readonly counterexample: { readonly actions: readonly Action[]; readonly replay: Replay } | null;
};

export function minimize(scenario: Scenario): readonly Action[] {
  if (replay(scenario).holds) return scenario.actions;
  let actions = [...scenario.actions];
  let index = 0;
  while (index < actions.length) {
    const candidate = actions.filter((_, position) => position !== index);
    if (replay({ workflow: scenario.workflow, actions: candidate }).holds) {
      index += 1;
    } else {
      actions = candidate;
      index = 0;
    }
  }
  return actions;
}

export const depthSchema = z.number().int().min(1).max(4);

export function explore(workflow: Workflow, maxDepth: number): SearchReport {
  const depth = depthSchema.parse(maxDepth);
  let frontier: readonly (readonly Action[])[] = [[]];
  let schedulesChecked = 0;
  let violationsFound = 0;
  let counterexample: SearchReport["counterexample"] = null;
  for (let level = 1; level <= depth; level += 1) {
    frontier = frontier.flatMap((prefix) =>
      actionSchema.options.map((action) => [...prefix, action]),
    );
    for (const actions of frontier) {
      const result = replay({ workflow, actions });
      schedulesChecked += 1;
      if (result.holds) continue;
      violationsFound += 1;
      if (counterexample === null) {
        const reduced = minimize({ workflow, actions });
        counterexample = { actions: reduced, replay: replay({ workflow, actions: reduced }) };
      }
    }
  }
  return { workflow, maxDepth: depth, schedulesChecked, violationsFound, counterexample };
}
