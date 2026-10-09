import { randomUUID } from "node:crypto";
import { assertNever } from "./domain.ts";
import type { ProposalView, RepairJobId, VerifiedView } from "./repair-web-contract.ts";
import { jobIdSchema, RepairWebError } from "./repair-web-contract.ts";

type BaseJob = { readonly root: string; readonly proposal: ProposalView };
export type RepairJob = BaseJob &
  (
    | { readonly phase: "proposed" }
    | { readonly phase: "verifying" }
    | { readonly phase: "failed" }
    | { readonly phase: "complete"; readonly result: VerifiedView }
  );

export class RepairJobStore {
  private readonly jobs = new Map<RepairJobId, RepairJob>();
  private active = false;
  private stopped = false;
  private attempts = 0;

  startProposal(): RepairJobId {
    this.acquire();
    if (this.attempts >= 5) {
      this.active = false;
      throw new RepairWebError("repair_limit", 429);
    }
    this.attempts += 1;
    return jobIdSchema.parse(randomUUID());
  }

  store(id: RepairJobId, root: string, proposal: ProposalView): void {
    this.jobs.set(id, { phase: "proposed", root, proposal });
  }

  get(id: RepairJobId): RepairJob {
    const job = this.jobs.get(id);
    if (job === undefined) throw new RepairWebError("repair_job_missing", 404);
    return job;
  }

  startVerification(id: RepairJobId, hash: string): RepairJob {
    const job = this.get(id);
    if (job.proposal.proposalHash !== hash)
      throw new RepairWebError("repair_approval_mismatch", 409);
    switch (job.phase) {
      case "complete":
        return job;
      case "proposed":
        this.acquire();
        this.jobs.set(id, { ...job, phase: "verifying" });
        return job;
      case "verifying":
        throw new RepairWebError("repair_busy", 409);
      case "failed":
        throw new RepairWebError("repair_job_failed", 409);
      default:
        return assertNever(job);
    }
  }

  complete(id: RepairJobId, result: VerifiedView): void {
    const job = this.get(id);
    this.jobs.set(id, { root: job.root, proposal: job.proposal, phase: "complete", result });
  }

  fail(id: RepairJobId): void {
    const job = this.get(id);
    this.jobs.set(id, { root: job.root, proposal: job.proposal, phase: "failed" });
  }

  release(): void {
    this.active = false;
  }
  stop(): void {
    this.stopped = true;
  }
  private acquire(): void {
    if (this.stopped) throw new RepairWebError("repair_closed", 503);
    if (this.active) throw new RepairWebError("repair_busy", 409);
    this.active = true;
  }
}
