import ky from "ky";
import type {
  RepairArtifact,
  RepairJobId,
  WebProposalRequest,
} from "../src/repair-web-contract.ts";
import {
  proposalViewSchema,
  repairSessionSchema,
  verifiedViewSchema,
} from "../src/repair-web-contract.ts";

const client = ky.create({ retry: 0, timeout: 90000 });
export const repairApi = {
  session: async () =>
    repairSessionSchema.parse(await client.get("/api/repair/session").json<unknown>()),
  propose: async (request: WebProposalRequest, token: string) =>
    proposalViewSchema.parse(
      await client
        .post("/api/repair/propose", {
          headers: { "x-counterexample-token": token },
          json: request,
        })
        .json<unknown>(),
    ),
  verify: async (
    request: {
      readonly jobId: RepairJobId;
      readonly proposalHash: string;
      readonly approved: true;
    },
    token: string,
  ) =>
    verifiedViewSchema.parse(
      await client
        .post("/api/repair/verify", { headers: { "x-counterexample-token": token }, json: request })
        .json<unknown>(),
    ),
  artifact: async (id: RepairJobId, name: RepairArtifact, token: string) =>
    client
      .get(`/api/repair/artifacts/${encodeURIComponent(id)}/${encodeURIComponent(name)}`, {
        headers: { "x-counterexample-token": token },
      })
      .blob(),
};
