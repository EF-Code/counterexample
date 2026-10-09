import type { Action } from "./domain.ts";
import { replay } from "./engine.ts";
import { explore, minimize } from "./search.ts";

export function createEvidence(maxDepth = 4) {
  const original: readonly Action[] = ["observe", "charge_timeout", "restart", "observe", "retry"];
  const reduced = minimize({ workflow: "vulnerable", actions: original });
  return {
    formatVersion: 1,
    provenance: "deterministic_fixture",
    property: "at_most_one_charge_per_intent",
    amountCents: 2500,
    original,
    reduced,
    originalReplay: replay({ workflow: "vulnerable", actions: original }),
    before: replay({ workflow: "vulnerable", actions: reduced }),
    referenceControl: replay({ workflow: "idempotent", actions: reduced }),
    exploration: {
      vulnerable: explore("vulnerable", maxDepth),
      idempotent: explore("idempotent", maxDepth),
    },
    limitations: [
      "One purchase intent, fixed amount, and in-memory fake provider.",
      "Provider idempotency records survive worker restart; expiration is not modeled.",
      "Reference control is hand-authored, not an AI-generated repair.",
      "No arbitrary repository execution or sandbox isolation is implemented.",
      "Passing bounded schedules is not a proof of unbounded correctness.",
    ],
  } as const;
}
