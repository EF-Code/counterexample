import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { secureHeaders } from "hono/secure-headers";
import { createApp } from "./app.ts";
import type { HostedConfig } from "./hosted-config.ts";
import { reserveHostedInference } from "./hosted-quota.ts";

export function createHostedApp(hosted: HostedConfig) {
  const app = new Hono();
  app.use("*", secureHeaders());
  app.use("*", async (c, next) => {
    const url = new URL(c.req.url);
    if (!hosted.trustedOrigins.includes(url.origin))
      return c.json({ error: "trusted_origin_required" }, 403);
    const origin = c.req.header("origin");
    if (origin !== undefined && origin !== url.origin)
      return c.json({ error: "same_origin_required" }, 403);
    c.header("cache-control", "no-store");
    await next();
  });
  if (hosted.credentials !== undefined)
    app.use(
      "/api/*",
      basicAuth({
        ...hosted.credentials,
        realm: "Counterexample demo",
      }),
    );
  app.get("/api/access", (c) => c.redirect("/"));
  const quota = hosted.quota;
  app.route(
    "/",
    createApp(hosted.config, undefined, {
      trustedOrigins: hosted.trustedOrigins,
      serveAssets: false,
      ...(quota === undefined ? {} : { reserveInference: () => reserveHostedInference(quota) }),
    }),
  );
  return app;
}
