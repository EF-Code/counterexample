import { assertNever } from "../src/domain.ts";
import type { InferenceResult } from "../src/promise.ts";
import type { Evidence } from "./contracts.ts";

export const samplePromise =
  "Never charge twice for the same purchase, even after timeout and retry.";
export type Approval =
  | { readonly source: "fixture" }
  | { readonly source: "live"; readonly result: InferenceResult };
export type Session =
  | { readonly phase: "draft"; readonly promise: string }
  | { readonly phase: "interpreting"; readonly promise: string }
  | { readonly phase: "review"; readonly promise: string; readonly result: InferenceResult }
  | { readonly phase: "approved"; readonly promise: string; readonly approval: Approval }
  | { readonly phase: "running"; readonly promise: string; readonly approval: Approval }
  | {
      readonly phase: "complete";
      readonly promise: string;
      readonly approval: Approval;
      readonly evidence: Evidence;
    }
  | { readonly phase: "error"; readonly promise: string; readonly message: string };

export function approve(session: Session): Session {
  switch (session.phase) {
    case "review":
      switch (session.result.interpretation.status) {
        case "supported":
          return {
            phase: "approved",
            promise: session.promise,
            approval: { source: "live", result: session.result },
          };
        case "unsupported":
          return session;
        default:
          return assertNever(session.result.interpretation);
      }
    case "draft":
    case "interpreting":
    case "approved":
    case "running":
    case "complete":
    case "error":
      return session;
    default:
      return assertNever(session);
  }
}

export function edit(_session: Session, promise: string): Session {
  return { phase: "draft", promise };
}

export function canRun(session: Session): boolean {
  return session.phase === "approved";
}

export function fixtureSession(): Session {
  return { phase: "approved", promise: samplePromise, approval: { source: "fixture" } };
}
