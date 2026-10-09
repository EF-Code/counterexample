import { assertNever } from "../src/domain.ts";
import { api, errorMessage } from "./api.ts";
import type { Health } from "./contracts.ts";
import { requiredElement } from "./dom.ts";
import { renderEvidence } from "./evidence-view.ts";
import type { RepairController } from "./repair-controller.ts";
import { renderApproval, renderInterpretation } from "./review.ts";
import type { Session } from "./state.ts";
import { approve, edit, fixtureSession, samplePromise } from "./state.ts";

const promise = requiredElement("promise", "textarea");
const consent = requiredElement("consent", "input");
const interpret = requiredElement("interpret", "button");
const fixture = requiredElement("fixture", "button");
const status = requiredElement("status", "p");
const errorBox = requiredElement("error", "div");
const review = requiredElement("review-content", "div");
const evidenceContent = requiredElement("evidence-content", "div");
const evidenceEmpty = requiredElement("evidence-empty", "div");
let health: Health | null = null;
let session: Session = { phase: "draft", promise: samplePromise };
let repairs: RepairController | null = null;
let repairLoading: Promise<void> | null = null;

function update(next: Session) {
  session = next;
  if (repairs !== null) repairs.setActive(next.phase === "complete");
  else if (next.phase === "complete" && repairLoading === null) {
    repairLoading = import("./repair-controller.ts")
      .then(({ RepairController }) => {
        repairs = new RepairController(requiredElement("repair-content", "div"));
        repairs.setActive(session.phase === "complete");
      })
      .catch((error: unknown) => {
        if (error instanceof Error)
          requiredElement("repair-content", "div").textContent =
            "The repair interface could not load. Reload the page to retry.";
        else throw error;
      });
  }
  const busy = next.phase === "interpreting" || next.phase === "running";
  promise.disabled = busy;
  consent.disabled = busy;
  fixture.disabled = busy;
  interpret.disabled =
    busy || !consent.checked || !health?.liveAiEnabled || !health.apiKeyConfigured;
  interpret.textContent =
    next.phase === "interpreting" ? "Interpreting…" : "Interpret with Nemotron";
  interpret.setAttribute("aria-busy", String(next.phase === "interpreting"));
  if (promise.value !== next.promise) promise.value = next.promise;
  errorBox.hidden = true;
  evidenceContent.hidden = next.phase !== "complete";
  evidenceEmpty.hidden = next.phase === "complete";
  switch (next.phase) {
    case "draft":
      review.textContent =
        "Interpret a promise, then review its meaning. Editing clears previous approval and evidence.";
      status.textContent = "Ready. Model calls require your consent and an explicit click.";
      break;
    case "interpreting":
      review.textContent = "Requesting a typed interpretation from NVIDIA Nemotron on Nebius…";
      status.textContent = "Interpreting. No execution has been approved.";
      break;
    case "review":
      review.replaceChildren(
        renderInterpretation(next.result, () => {
          update(approve(session));
          document.getElementById("run-fixture")?.focus();
        }),
      );
      status.textContent = "Interpretation returned. Review the scope before approval.";
      break;
    case "approved":
      review.replaceChildren(renderApproval(next.approval, () => void run()));
      status.textContent = "Meaning selected. Run the fixture to produce execution evidence.";
      break;
    case "running":
      review.textContent = "Executing and reducing the deterministic billing fixture…";
      status.textContent = "Running the fake payment provider. No real money is involved.";
      break;
    case "complete":
      review.replaceChildren(renderApproval(next.approval, () => void run()));
      evidenceContent.replaceChildren(renderEvidence(next.evidence, download));
      status.textContent =
        "Execution complete: the vulnerable workflow violated the promise; the reference passed this trace.";
      break;
    case "error":
      review.textContent =
        "No result was accepted. Retry interpretation, or use the labeled offline fixture.";
      status.textContent = "The request failed. No new execution evidence is available.";
      errorBox.hidden = false;
      errorBox.textContent = next.message;
      break;
    default:
      assertNever(next);
  }
}

async function run() {
  const current = session;
  switch (current.phase) {
    case "approved":
    case "complete":
      break;
    case "draft":
    case "interpreting":
    case "review":
    case "running":
    case "error":
      return;
    default:
      return assertNever(current);
  }
  const pending: Session = {
    phase: "running",
    promise: current.promise,
    approval: current.approval,
  };
  update(pending);
  try {
    const evidence = await api.evidence();
    if (session !== pending) return;
    update({ phase: "complete", promise: current.promise, approval: current.approval, evidence });
  } catch (error) {
    if (session === pending)
      update({ phase: "error", promise: current.promise, message: await errorMessage(error) });
  }
}

function download() {
  switch (session.phase) {
    case "complete":
      break;
    case "draft":
    case "interpreting":
    case "review":
    case "approved":
    case "running":
    case "error":
      return;
    default:
      return assertNever(session);
  }
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(session, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "counterexample-evidence.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

requiredElement("promise-form", "form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (interpret.disabled || !consent.checked) return;
  const pending: Session = { phase: "interpreting", promise: promise.value.trim() };
  update(pending);
  try {
    const result = await api.interpret(pending.promise);
    if (session === pending) update({ phase: "review", promise: pending.promise, result });
  } catch (error) {
    if (session === pending)
      update({ phase: "error", promise: pending.promise, message: await errorMessage(error) });
  }
});
promise.addEventListener("input", () => update(edit(session, promise.value)));
consent.addEventListener("change", () => update(session));
fixture.addEventListener("click", () => {
  update(fixtureSession());
  void run();
});
update(session);
api
  .health()
  .then((result) => {
    health = result;
    const connection = requiredElement("connection", "span");
    connection.textContent =
      result.liveAiEnabled && result.apiKeyConfigured ? "Live AI configured" : "Fixture mode";
    connection.className = `badge ${result.liveAiEnabled && result.apiKeyConfigured ? "live" : ""}`;
    requiredElement("model-label", "p").textContent = result.model;
    update(session);
  })
  .catch((error: unknown) => {
    requiredElement("connection", "span").textContent = "API unavailable";
    if (error instanceof Error)
      status.textContent = "Cannot reach the API. Check that the local server is running.";
    else throw error;
  });
