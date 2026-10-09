import { z } from "zod";
import { assertNever } from "../src/domain.ts";
import type { RepairSession } from "../src/repair-web-contract.ts";
import { badge, button, element } from "./dom.ts";
import type { RepairActions, RepairState } from "./repair-state.ts";
import { approvalControls, proposalReview, verificationView } from "./repair-view.ts";

function sourceControls(session: RepairSession, actions: RepairActions): HTMLElement {
  const controls = element("div", "stack");
  const label = element("label", "field-label", "Proposal source");
  const select = element("select", "repair-select");
  select.id = "repair-source";
  label.htmlFor = select.id;
  const reference = element("option", "", "Reference proposal (no model call)");
  reference.value = "reference";
  const live = element("option", "", "NVIDIA Nemotron on Nebius");
  live.value = "nebius";
  live.disabled = !session.liveAvailable;
  select.append(reference, live);
  const consentLabel = element("label", "check-label");
  const consent = element("input");
  consent.type = "checkbox";
  consentLabel.append(
    consent,
    document.createTextNode(
      "Send only the curated example source and captured failure to Nebius. This makes one billed request.",
    ),
  );
  consentLabel.hidden = true;
  const propose = button(
    "Create reference proposal",
    () => actions.propose(z.enum(["reference", "nebius"]).parse(select.value), consent.checked),
    "",
  );
  select.addEventListener("change", () => {
    consent.checked = false;
    consentLabel.hidden = select.value !== "nebius";
    propose.disabled = select.value === "nebius";
    propose.textContent =
      select.value === "nebius" ? "Request Nemotron proposal" : "Create reference proposal";
  });
  consent.addEventListener("change", () => {
    propose.disabled = !consent.checked;
  });
  controls.append(
    label,
    select,
    consentLabel,
    propose,
    element(
      "p",
      "small muted",
      "At most five proposal attempts per server run; one active repair operation. Original files remain untouched.",
    ),
  );
  return controls;
}

export function renderRepair(
  state: RepairState,
  availability: {
    readonly active: boolean;
    readonly session: RepairSession | null;
    readonly availabilityError: string | null;
  },
  actions: RepairActions,
): HTMLElement {
  const content = element("div", "stack");
  if (!availability.active) {
    content.append(
      element(
        "p",
        "small muted",
        "Run the billing fixture above to unlock the curated repair flow.",
      ),
    );
    return content;
  }
  if (availability.session === null) {
    if (availability.availabilityError !== null) {
      const error = element("p", "notice failure", availability.availabilityError);
      error.setAttribute("role", "alert");
      content.append(error, button("Reload repair availability", actions.reloadAvailability));
    } else content.append(element("p", "notice", "Checking repair availability…"));
    return content;
  }
  if (!availability.session.enabled) {
    content.append(
      element(
        "p",
        "notice",
        "Browser repair is disabled. Set ENABLE_REPAIR_SANDBOX=true in the server environment and restart. Requires local Docker and node:24-alpine.",
      ),
    );
    return content;
  }
  content.append(
    element(
      "p",
      "notice",
      "Curated single-purchase example only. This is not arbitrary repository execution or a production billing patch.",
    ),
  );
  switch (state.phase) {
    case "idle":
      content.append(sourceControls(availability.session, actions));
      break;
    case "proposing":
      content.append(badge("Building proposal and reproducing baseline…", "warning"));
      break;
    case "review":
      content.append(
        proposalReview(state.proposal),
        approvalControls(() => actions.verify(state.proposal)),
        button("Download proposed diff", () => actions.download(state.proposal, "change.diff")),
      );
      break;
    case "verifying":
      content.append(
        proposalReview(state.proposal),
        badge("Verifying candidate in Docker…", "warning"),
      );
      break;
    case "result":
      content.append(
        verificationView(state.result),
        button("Download repair bundle (JSON)", () =>
          actions.download(state.proposal, "repair-bundle.json"),
        ),
        button("Download verification", () =>
          actions.download(state.proposal, "verification.json"),
        ),
      );
      break;
    case "error": {
      const error = element("div", "notice failure", state.message);
      error.setAttribute("role", "alert");
      content.append(error);
      break;
    }
    default:
      assertNever(state);
  }
  if (state.phase === "result" || state.phase === "error")
    content.append(button("Start a new proposal", actions.reset));
  const status = element("p", "sr-only", state.phase);
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  content.append(status);
  return content;
}
