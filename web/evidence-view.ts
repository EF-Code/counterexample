import type { Replay } from "../src/domain.ts";
import type { Evidence } from "./contracts.ts";
import { badge, button, element } from "./dom.ts";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const actionLabels = {
  charge: "Attempt the purchase",
  charge_timeout: "Payment commits, response times out",
  retry: "Retry the same purchase",
  restart: "Worker restarts",
  observe: "Observe provider state",
} as const;
const outcomeLabels = {
  committed: "Provider creates a successful charge",
  deduplicated: "Provider reuses the existing charge",
  already_confirmed: "Worker skips an acknowledged purchase",
  restarted: "Worker loses local acknowledgement; provider records survive",
  observed: "No state changed",
} as const;

function receipt(result: Replay, title: string): HTMLElement {
  const section = element("section", `receipt ${result.holds ? "success" : "failure"}`);
  section.append(element("h3", "", title));
  section.append(
    badge(
      result.holds ? "Promise holds for this trace" : "Promise violated",
      result.holds ? "success" : "failure",
    ),
  );
  const values = element("dl");
  values.append(
    element("dt", "", "Successful charges"),
    element("dd", "", String(result.successfulCharges)),
    element("dt", "", "Total charged"),
    element("dd", "total", money.format(result.chargedCents / 100)),
  );
  section.append(values);
  section.append(
    element(
      "p",
      "small muted",
      result.holds
        ? "Hand-authored reference. Stable provider idempotency key. Not an AI-generated repair."
        : "New attempt key on retry. The timeout hid a payment that already committed.",
    ),
  );
  return section;
}

function eventRail(replay: Replay): HTMLOListElement {
  const rail = element("ol", "trace");
  rail.setAttribute("aria-label", "Executed event sequence");
  for (const event of replay.trace) {
    const row = element("li");
    row.dataset["violation"] = String(event.successfulCharges > 1);
    const description = element("div");
    description.append(element("p", "event-name", actionLabels[event.action]));
    description.append(element("p", "event-detail", outcomeLabels[event.outcome]));
    if (event.response !== "none") {
      description.append(element("p", "event-detail mono", `response: ${event.response}`));
    }
    row.append(
      element("span", "event-number", String(event.step)),
      description,
      element(
        "span",
        "event-count",
        `${event.successfulCharges} charge${event.successfulCharges === 1 ? "" : "s"}`,
      ),
    );
    rail.append(row);
  }
  return rail;
}

export function renderEvidence(evidence: Evidence, onDownload: () => void): HTMLElement {
  const content = element("div", "stack");
  const receipts = element("div", "receipts");
  receipts.append(
    receipt(evidence.before, "Vulnerable workflow"),
    receipt(evidence.referenceControl, "Idempotent reference"),
  );
  content.append(receipts);

  const tracePanel = element("section", "panel stack");
  const heading = element("div", "trace-heading");
  heading.append(element("h3", "", "The breaking sequence"));
  const controls = element("div", "trace-controls");
  controls.setAttribute("aria-label", "Trace detail");
  const railContainer = element("div");
  const note = element("p", "small muted");
  const full = button("Full trace", () => show(false));
  const reduced = button("Reduced trace", () => show(true));
  function show(isReduced: boolean) {
    full.setAttribute("aria-pressed", String(!isReduced));
    reduced.setAttribute("aria-pressed", String(isReduced));
    railContainer.replaceChildren(eventRail(isReduced ? evidence.before : evidence.originalReplay));
    note.textContent = isReduced
      ? `${evidence.original.length} events reduced to ${evidence.reduced.length}. Removing either remaining event prevents this violation.`
      : "Original schedule, including observations and the worker restart. All actions refer to the same purchase.";
  }
  controls.append(full, reduced);
  heading.append(controls);
  tracePanel.append(heading, note, railContainer);
  show(true);
  content.append(tracePanel);

  const scope = element("section", "panel");
  const details = element("details");
  details.append(element("summary", "", "Bounded search and limitations"));
  const search = element("div", "search-results");
  for (const [label, report] of [
    ["Vulnerable workflow", evidence.exploration.vulnerable],
    ["Idempotent reference", evidence.exploration.idempotent],
  ] as const) {
    const column = element("div", "stack");
    column.append(element("h3", "", label));
    column.append(
      element(
        "strong",
        "",
        `${report.violationsFound} / ${report.schedulesChecked} violating schedules`,
      ),
    );
    column.append(element("p", "muted", `Maximum depth ${report.maxDepth}. Fixture results only.`));
    search.append(column);
  }
  const limits = element("ul", "limits");
  for (const limitation of evidence.limitations) limits.append(element("li", "", limitation));
  details.append(search, limits);
  const actions = element("div", "evidence-actions");
  actions.append(badge("Executed fixture evidence"), button("Download evidence", onDownload));
  scope.append(actions, details);
  content.append(scope);
  return content;
}
