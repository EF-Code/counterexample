import type { WorkflowFactory } from "./billing-runtime.ts";
import type { Workflow } from "./domain.ts";
import { assertNever } from "./domain.ts";

export function builtinWorkflow(workflow: Workflow): WorkflowFactory {
  switch (workflow) {
    case "vulnerable":
      return (provider) => {
        let confirmed = false;
        return {
          attempt: () => {
            if (confirmed) return;
            confirmed = provider.charge(null) === "acknowledged";
          },
        };
      };
    case "idempotent":
      return (provider) => {
        let confirmed = false;
        return {
          attempt: () => {
            if (confirmed) return;
            confirmed = provider.charge("purchase:demo-001") === "acknowledged";
          },
        };
      };
    default:
      return assertNever(workflow);
  }
}
