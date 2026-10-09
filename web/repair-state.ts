import type { ProposalView, RepairArtifact, VerifiedView } from "../src/repair-web-contract.ts";

export type RepairState =
  | { readonly phase: "idle" }
  | { readonly phase: "proposing" }
  | { readonly phase: "review"; readonly proposal: ProposalView }
  | { readonly phase: "verifying"; readonly proposal: ProposalView }
  | { readonly phase: "result"; readonly proposal: ProposalView; readonly result: VerifiedView }
  | { readonly phase: "error"; readonly message: string };
export type RepairActions = {
  readonly propose: (mode: "reference" | "nebius", consent: boolean) => void;
  readonly verify: (proposal: ProposalView) => void;
  readonly download: (proposal: ProposalView, name: RepairArtifact) => void;
  readonly reset: () => void;
  readonly reloadAvailability: () => void;
};
