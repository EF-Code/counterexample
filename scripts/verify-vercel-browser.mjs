import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { chromium, expect } from "@playwright/test";
import { Hono } from "hono";

process.env.APP_PUBLIC_ORIGINS = "https://counterexample.example";
process.env.ENABLE_LIVE_AI = "false";
process.env.ENABLE_REPAIR_SANDBOX = "false";
delete process.env.NEBIUS_API_KEY;
process.env.HOSTED_USERNAME = "judge";
process.env.HOSTED_PASSWORD = "test-only-password-with-32-characters";
const { default: handler } = await import(
  "../.vercel/output/functions/api/index.func/api/index.js"
);
const app = new Hono();
app.all("/api/*", async (c) => {
  const url = new URL(c.req.url);
  url.protocol = "https:";
  url.host = "counterexample.example";
  url.port = "";
  return handler.fetch(
    new Request(url, {
      method: c.req.method,
      headers: c.req.raw.headers,
      ...(c.req.method === "GET" || c.req.method === "HEAD"
        ? {}
        : { body: await c.req.arrayBuffer() }),
    }),
  );
});
const root = fileURLToPath(new URL("../.vercel/output/static/", import.meta.url));
app.get("/", serveStatic({ path: `${root}index.html` }));
app.get("/assets/*", serveStatic({ root }));
app.get("/mark.svg", serveStatic({ path: `${root}mark.svg` }));
let server;
const base = await new Promise((resolve) => {
  server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 }, (info) =>
    resolve(`http://127.0.0.1:${info.port}`),
  );
});
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  const context = await browser.newContext({
    httpCredentials: {
      username: "judge",
      password: process.env.HOSTED_PASSWORD,
    },
  });
  const page = await context.newPage();
  let paidRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/interpret")) paidRequests += 1;
  });
  await page.goto(`${base}/api/access`);
  await expect(page).toHaveURL(`${base}/`);
  await page.getByRole("button", { name: "Try offline fixture" }).click();
  await expect(page.getByText("Offline fixture · no AI call")).toBeVisible();
  await expect(page.getByText("$50.00", { exact: true })).toBeVisible();
  await expect(page.getByText("$25.00", { exact: true })).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download evidence" }).click();
  const path = await (await pending).path();
  assert.notEqual(path, null);
  const evidence = JSON.parse(await readFile(path, "utf8"));
  assert.equal(evidence.evidence.before.successfulCharges, 2);
  assert.equal(paidRequests, 0);
  const session = await page.request.get(`${base}/api/repair/session`);
  assert.equal((await session.json()).enabled, false);
  process.stdout.write(
    "Packaged frontend browser smoke passed: Basic Auth navigation, fixture replay, evidence download, disabled repair. Local HTTPS-origin simulation; not external Vercel validation.\n",
  );
} finally {
  if (browser !== undefined) await browser.close();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
