import { assertNever } from "../src/domain.ts";
import type { InferenceResult } from "../src/promise.ts";
import { badge, button, element } from "./dom.ts";
import type { Approval } from "./state.ts";

export function renderInterpretation(result: InferenceResult, onApprove: () => void): HTMLElement {
  const content = element("div", "stack");
  content.append(badge("Live NVIDIA interpretation", "live"));
  const interpretation = result.interpretation;
  switch (interpretation.status) {
    case "supported":
      content.append(
        element("p", "small", interpretation.explanation),
        element("code", "property-code", interpretation.property),
        element(
          "p",
          "small muted",
          "Scope: one purchase intent. Review this meaning before running the fixed billing fixture.",
        ),
        button("Approve this meaning", onApprove, ""),
      );
      break;
    case "unsupported":
      content.append(
        badge("Outside supported scope", "warning"),
        element("p", "small", interpretation.reason),
      );
      break;
    default:
      return assertNever(interpretation);
  }
  content.append(element("p", "small muted mono", result.responseModel));
  if (result.usage !== null) {
    content.append(
      element(
        "p",
        "small muted",
        `${result.usage.prompt_tokens} input · ${result.usage.completion_tokens} output tokens`,
      ),
    );
  }
  return content;
}

export function renderApproval(approval: Approval, onRun: () => void): HTMLElement {
  const content = element("div", "stack");
  switch (approval.source) {
    case "fixture":
      content.append(badge("Offline fixture · no AI call", "warning"));
      content.append(
        element(
          "p",
          "small",
          "The supplied sample maps to one successful charge per purchase intent. This meaning was supplied by the fixture, not inferred by a model.",
        ),
      );
      break;
    case "live":
      content.append(badge("Meaning approved", "live"));
      content.append(
        element(
          "p",
          "small",
          "Your reviewed interpretation authorizes the supported billing fixture only. No repository code is generated or executed.",
        ),
      );
      break;
    default:
      return assertNever(approval);
  }
  content.append(element("code", "property-code", "at_most_one_charge_per_intent"));
  const run = button("Run billing fixture", onRun, "");
  run.id = "run-fixture";
  content.append(run);
  return content;
}
