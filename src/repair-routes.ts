import { Hono } from "hono";
import {
  artifactSchema,
  jobIdSchema,
  webApprovalSchema,
  webProposalRequestSchema,
} from "./repair-web-contract.ts";
import type { RepairService } from "./repair-web-service.ts";

export function repairRoutes(service: RepairService) {
  const routes = new Hono();
  routes.get("/session", (c) => {
    c.header("Cache-Control", "no-store");
    return c.json(service.session());
  });
  routes.use("*", async (c, next) => {
    service.authorize(c.req.header("x-counterexample-token"));
    await next();
  });
  routes.post("/propose", async (c) => {
    const body: unknown = await c.req.json();
    return c.json(await service.propose(webProposalRequestSchema.parse(body)));
  });
  routes.post("/verify", async (c) => {
    const body: unknown = await c.req.json();
    return c.json(await service.verify(webApprovalSchema.parse(body)));
  });
  routes.get("/artifacts/:jobId/:name", async (c) => {
    const jobId = jobIdSchema.parse(c.req.param("jobId"));
    const name = artifactSchema.parse(c.req.param("name"));
    c.header("Content-Disposition", `attachment; filename="${name}"`);
    c.header("Cache-Control", "no-store");
    return c.body(await service.artifact(jobId, name), 200, {
      "Content-Type": name.endsWith(".json") ? "application/json" : "text/plain; charset=utf-8",
    });
  });
  return routes;
}
