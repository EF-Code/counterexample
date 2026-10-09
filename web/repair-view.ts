import type { ProposalView, VerifiedView } from "../src/repair-web-contract.ts";
import { badge, button, element } from "./dom.ts";

export function proposalReview(proposal: ProposalView): HTMLElement {
  const view = element("div", "stack");
  view.append(
    badge(
      proposal.record.source === "reference"
        ? "Reference proposal · no model call"
        : "NVIDIA repair proposal",
      proposal.record.source === "reference" ? "warning" : "live",
    ),
  );
  view.append(element("p", "small", proposal.record.proposal.rationale));
  const comparisons = element("div", "repair-code-grid");
  for (const [label, source] of [
    ["Original service.ts", proposal.before],
    ["Proposed service.ts", proposal.after],
  ] as const) {
    const column = element("div", "stack");
    column.append(element("h3", "", label));
    const pre = element("pre", "repair-code");
    pre.append(element("code", "", source));
    column.append(pre);
    comparisons.append(column);
  }
  view.append(comparisons);
  const details = element("details");
  details.append(
    element("summary", "", "Exact proposed diff"),
    element("pre", "repair-code", proposal.diff),
  );
  view.append(details);
  view.append(
    element(
      "p",
      "small muted",
      `Observed baseline: ${proposal.record.baseline.captured.successfulCharges} charges; ${proposal.record.baseline.violationsFound}/${proposal.record.baseline.schedulesChecked} violating schedules.`,
    ),
  );
  const metadata = proposal.record.inference;
  if (metadata !== null) {
    view.append(element("p", "small muted mono", metadata.responseModel));
    if (metadata.usage !== null)
      view.append(
        element(
          "p",
          "small muted",
          `${metadata.usage.prompt_tokens} input · ${metadata.usage.completion_tokens} output tokens`,
        ),
      );
  }
  return view;
}

export function verificationView(result: VerifiedView): HTMLElement {
  const view = element("div", "stack");
  view.append(
    badge(
      result.accepted ? "Candidate verified within fixture scope" : "Candidate not accepted",
      result.accepted ? "success" : "failure",
    ),
  );
  const stats = element("dl", "repair-result");
  stats.append(
    element("dt", "", "Captured purchase"),
    element("dd", "mono", `${result.verification.captured.successfulCharges} successful charge`),
    element("dt", "", "Additional schedules"),
    element(
      "dd",
      "mono",
      `${result.verification.violationsFound} / ${result.verification.schedulesChecked} violations`,
    ),
    element("dt", "", "Generated regression"),
    element("dd", "", result.regressionPassed ? "Passed in Docker" : "Failed"),
    element("dt", "", "Original project"),
    element("dd", "", "Unchanged"),
  );
  view.append(stats);
  view.append(
    element(
      "p",
      "small muted",
      "Bounded execution evidence, not an unbounded proof or a production multi-purchase billing patch. Containers share the host kernel.",
    ),
  );
  const details = element("details");
  details.append(
    element("summary", "", "Pinned execution image"),
    element("code", "property-code", result.imageId),
  );
  view.append(details);
  return view;
}

export function approvalControls(onVerify: () => void): HTMLElement {
  const container = element("div", "stack");
  const label = element("label", "check-label");
  const checkbox = element("input");
  checkbox.type = "checkbox";
  label.append(
    checkbox,
    document.createTextNode(
      "I reviewed this service.ts change and approve running the candidate in Docker.",
    ),
  );
  const verify = button("Approve and verify in Docker", onVerify, "");
  verify.disabled = true;
  checkbox.addEventListener("change", () => {
    verify.disabled = !checkbox.checked;
  });
  container.append(label, verify);
  return container;
}
