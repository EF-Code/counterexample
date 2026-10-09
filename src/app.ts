import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { compress } from "hono/compress";
import { z } from "zod";
import type { AppConfig } from "./config.ts";
import { scenarioSchema, workflowSchema } from "./domain.ts";
import { replay } from "./engine.ts";
import { createEvidence } from "./evidence.ts";
import { HostedQuotaError } from "./hosted-quota.ts";
import { logger } from "./logger.ts";
import { InferenceError, interpretPromise } from "./nebius.ts";
import { interpretationRequestSchema } from "./promise.ts";
import { repairRoutes } from "./repair-routes.ts";
import { RepairWebError } from "./repair-web-contract.ts";
import type { RepairService } from "./repair-web-service.ts";
import { createRepairService } from "./repair-web-service.ts";
import { depthSchema, explore, minimize } from "./search.ts";

const searchRequestSchema = z.strictObject({
  workflow: workflowSchema,
  maxDepth: depthSchema.default(3),
});

export type AppPolicy = {
  readonly trustedOrigins?: readonly string[];
  readonly serveAssets?: boolean;
  readonly reserveInference?: () => Promise<boolean>;
};

export function createApp(
  config: AppConfig,
  repairs: RepairService = createRepairService(config),
  policy: AppPolicy = {},
) {
  const app = new Hono();
  let inferenceCalls = 0;
  app.use("*", async (c, next) => {
    const url = new URL(c.req.url);
    const trusted =
      policy.trustedOrigins === undefined
        ? url.hostname === "127.0.0.1" || url.hostname === "localhost"
        : policy.trustedOrigins.includes(url.origin);
    if (!trusted) {
      return c.json(
        {
          error:
            policy.trustedOrigins === undefined
              ? "loopback_host_required"
              : "trusted_origin_required",
        },
        403,
      );
    }
    const origin = c.req.header("origin");
    if (origin !== undefined && origin !== url.origin) {
      return c.json({ error: "same_origin_required" }, 403);
    }
    if (c.req.method === "POST") {
      const contentType = c.req.header("content-type")?.split(";")[0]?.trim().toLowerCase();
      if (contentType !== "application/json") return c.json({ error: "json_required" }, 415);
    }
    await next();
  });
  app.use(
    "/api/*",
    bodyLimit({
      maxSize: 16 * 1024,
      onError: (c) => c.json({ error: "body_too_large" }, 413),
    }),
  );
  if (policy.serveAssets !== false) {
    const publicRoot = fileURLToPath(new URL("../dist/client/", import.meta.url));
    app.use("/assets/*", compress({ encoding: "gzip" }));
    app.get("/", serveStatic({ path: `${publicRoot}index.html` }));
    app.get("/primitives.html", serveStatic({ path: `${publicRoot}primitives.html` }));
    app.get("/mark.svg", serveStatic({ path: `${publicRoot}mark.svg` }));
    app.get("/assets/*", serveStatic({ root: publicRoot }));
  }
  app.get("/api/health", (c) =>
    c.json({
      status: "ok",
      liveAiEnabled: config.ENABLE_LIVE_AI === "true",
      apiKeyConfigured: Boolean(config.NEBIUS_API_KEY),
      model: config.NEBIUS_MODEL,
    }),
  );
  app.get("/api/demo", (c) => c.json(createEvidence()));
  app.route("/api/repair", repairRoutes(repairs));
  app.post("/api/replay", async (c) => {
    const input: unknown = await c.req.json();
    return c.json(replay(scenarioSchema.parse(input)));
  });
  app.post("/api/minimize", async (c) => {
    const input: unknown = await c.req.json();
    const scenario = scenarioSchema.parse(input);
    const actions = minimize(scenario);
    return c.json({
      actions,
      failing: !replay(scenario).holds,
      replay: replay({ workflow: scenario.workflow, actions }),
      reduction: "single-deletion-minimal, not necessarily globally shortest",
    });
  });
  app.post("/api/explore", async (c) => {
    const input: unknown = await c.req.json();
    const request = searchRequestSchema.parse(input);
    return c.json(explore(request.workflow, request.maxDepth));
  });
  app.post("/api/interpret", async (c) => {
    if (config.ENABLE_LIVE_AI !== "true") return c.json({ error: "live_ai_disabled" }, 503);
    if (!config.NEBIUS_API_KEY) return c.json({ error: "api_key_missing" }, 503);
    const input: unknown = await c.req.json();
    const request = interpretationRequestSchema.parse(input);
    if (policy.reserveInference !== undefined) {
      if (!(await policy.reserveInference()))
        return c.json({ error: "hosted_inference_limit" }, 429);
    } else {
      if (inferenceCalls >= 10) return c.json({ error: "session_inference_limit" }, 429);
      inferenceCalls += 1;
    }
    const result = await interpretPromise(request.promise, {
      apiKey: config.NEBIUS_API_KEY,
      model: config.NEBIUS_MODEL,
      endpoint: "https://api.tokenfactory.nebius.com/v1/chat/completions",
    });
    return c.json(result);
  });
  app.onError((error, c) => {
    if (error instanceof HostedQuotaError) {
      logger.error({ event: "quota.failed", code: error.code }, "quota unavailable");
      return c.json({ error: "inference_budget_unavailable" }, 503);
    }
    if (error instanceof RepairWebError) {
      if (error.status >= 500)
        logger.error({ event: "repair.failed", code: error.code }, "repair failed");
      return c.json({ error: error.code }, error.status);
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return c.json({ error: "invalid_request" }, 400);
    }
    if (error instanceof InferenceError) {
      logger.error({ event: "inference.failed", code: error.code }, "inference failed");
      return c.json({ error: error.code }, 502);
    }
    logger.error({ event: "request.failed", errorType: error.name }, "request failed");
    return c.json({ error: "internal_error" }, 500);
  });
  return app;
}

import { fileURLToPath } from "node:url";
import { serveStatic } from "@hono/node-server/serve-static";
