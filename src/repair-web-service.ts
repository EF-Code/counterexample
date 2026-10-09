import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppConfig } from "./config.ts";
import { SandboxError } from "./docker-sandbox.ts";
import { InferenceError } from "./nebius.ts";
import { repairArtifact } from "./repair-artifacts.ts";
import { applyRepair, RepairError } from "./repair-contract.ts";
import { createProposal, verifyProposal } from "./repair-flow.ts";
import { RepairJobStore } from "./repair-job-store.ts";
import { sha256 } from "./repair-snapshot.ts";
import type {
  ProposalView,
  RepairArtifact,
  RepairJobId,
  RepairSession,
  VerifiedView,
  WebProposalRequest,
} from "./repair-web-contract.ts";
import { hashSchema, RepairWebError } from "./repair-web-contract.ts";

function webFailure(error: unknown): RepairWebError {
  if (error instanceof RepairWebError) return error;
  if (
    error instanceof RepairError ||
    error instanceof SandboxError ||
    error instanceof InferenceError
  )
    return new RepairWebError(error.code, 502);
  return new RepairWebError("repair_operation_failed", 500);
}

export interface RepairService {
  readonly session: () => RepairSession;
  readonly authorize: (token: string | undefined) => void;
  readonly propose: (request: WebProposalRequest) => Promise<ProposalView>;
  readonly verify: (request: {
    readonly jobId: RepairJobId;
    readonly proposalHash: string;
    readonly approved: true;
  }) => Promise<VerifiedView>;
  readonly artifact: (jobId: RepairJobId, name: RepairArtifact) => Promise<string>;
  readonly close: () => Promise<void>;
}

export function createRepairService(config: AppConfig): RepairService {
  const token = randomBytes(32).toString("hex");
  const enabled = config.ENABLE_REPAIR_SANDBOX === "true";
  const store = new RepairJobStore();
  const roots = new Set<string>();
  let pending: Promise<ProposalView | VerifiedView> | null = null;
  const requireEnabled = () => {
    if (!enabled) throw new RepairWebError("repair_disabled", 503);
  };

  async function propose(id: RepairJobId, request: WebProposalRequest): Promise<ProposalView> {
    const root = await mkdtemp(join(tmpdir(), "counterexample-web-repair-"));
    roots.add(root);
    try {
      let inference: Parameters<typeof createProposal>[0]["inference"];
      switch (request.mode) {
        case "reference":
          inference = { source: "reference" };
          break;
        case "nebius":
          if (config.ENABLE_LIVE_AI !== "true" || !config.NEBIUS_API_KEY)
            throw new RepairWebError("live_ai_disabled", 503);
          inference = {
            source: "nebius",
            consentToSendSource: true,
            connection: {
              apiKey: config.NEBIUS_API_KEY,
              model: config.NEBIUS_MODEL,
              endpoint: "https://api.tokenfactory.nebius.com/v1/chat/completions",
            },
          };
          break;
      }
      const record = await createProposal({
        projectDirectory: fileURLToPath(new URL("../examples/billing-service/", import.meta.url)),
        outputDirectory: join(root, "proposal"),
        inference,
      });
      const before = await readFile(join(root, "proposal", "service.ts"), "utf8");
      const view: ProposalView = {
        jobId: id,
        proposalHash: sha256(JSON.stringify(record)),
        record,
        before,
        after: applyRepair(before, record.proposal),
        diff: await readFile(join(root, "proposal", "change.diff"), "utf8"),
      };
      store.store(id, root, view);
      return view;
    } catch (error) {
      await rm(root, { recursive: true, force: true });
      roots.delete(root);
      throw webFailure(error);
    }
  }

  return {
    session: () => ({
      enabled,
      liveAvailable: config.ENABLE_LIVE_AI === "true" && Boolean(config.NEBIUS_API_KEY),
      token: enabled ? token : null,
      limit: 5,
    }),
    authorize: (supplied) => {
      if (!enabled) throw new RepairWebError("repair_disabled", 503);
      if (
        !hashSchema.safeParse(supplied).success ||
        supplied === undefined ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
      )
        throw new RepairWebError("repair_session_invalid", 403);
    },
    propose: (request) => {
      requireEnabled();
      const id = store.startProposal();
      const operation = propose(id, request).finally(() => {
        store.release();
        pending = null;
      });
      pending = operation;
      return operation;
    },
    verify: async (request) => {
      requireEnabled();
      const job = store.startVerification(request.jobId, request.proposalHash);
      if (job.phase === "complete") return job.result;
      const operation = verifyProposal({
        proposalDirectory: join(job.root, "proposal"),
        outputDirectory: join(job.root, "candidate"),
        approved: true,
      })
        .then((result) => {
          store.complete(request.jobId, result);
          return result;
        })
        .catch((error: unknown) => {
          store.fail(request.jobId);
          throw webFailure(error);
        })
        .finally(() => {
          store.release();
          pending = null;
        });
      pending = operation;
      return operation;
    },
    artifact: async (id, name) => {
      requireEnabled();
      return repairArtifact(store.get(id), name);
    },
    close: async () => {
      store.stop();
      try {
        if (pending !== null) await pending;
      } finally {
        for (const root of roots) await rm(root, { recursive: true, force: true });
        roots.clear();
      }
    },
  };
}
