import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const root = new URL("../.vercel/output/", import.meta.url);
const functionRoot = new URL("functions/api/index.func/", root);
const metadata = JSON.parse(await readFile(new URL(".vc-config.json", functionRoot), "utf8"));
assert.equal(metadata.runtime, "nodejs24.x");
const entries = await readdir(functionRoot);
for (const forbidden of ["artifacts", "examples", "dist", ".env", ".env.local", ".vercel"])
  assert.equal(entries.includes(forbidden), false, `Private/unneeded bundle entry: ${forbidden}`);
const staticEntries = await readdir(new URL("static/", root));
assert.ok(staticEntries.includes("index.html"));
for (const entry of staticEntries)
  assert.equal(entry.startsWith(".env") || ["src", "artifacts", "examples"].includes(entry), false);
const routes = JSON.parse(await readFile(new URL("config.json", root), "utf8")).routes;
assert.ok(routes.some((route) => route.dest?.startsWith("/api/index")));

for (const key of [
  "APP_PUBLIC_ORIGINS",
  "VERCEL_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "ENABLE_LIVE_AI",
  "ENABLE_REPAIR_SANDBOX",
  "NEBIUS_API_KEY",
  "HOSTED_USERNAME",
  "HOSTED_PASSWORD",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
])
  delete process.env[key];
process.env.APP_PUBLIC_ORIGINS = "https://counterexample.example";
const { default: handler } = await import(new URL("api/index.js", functionRoot).href);
const origin = "https://counterexample.example";
const demo = await handler.fetch(new Request(`${origin}/api/demo`));
assert.equal(demo.status, 200);
assert.equal((await demo.json()).before.successfulCharges, 2);
const session = await handler.fetch(new Request(`${origin}/api/repair/session`));
assert.deepEqual((await session.json()).enabled, false);
const rejected = await handler.fetch(new Request("https://attacker.example/api/demo"));
assert.equal(rejected.status, 403);
const crossOrigin = await handler.fetch(
  new Request(`${origin}/api/demo`, {
    headers: { origin: "https://attacker.example" },
  }),
);
assert.equal(crossOrigin.status, 403);
process.env.HOSTED_USERNAME = "judge";
process.env.HOSTED_PASSWORD = "test-only-password-with-32-characters";
const anonymous = await handler.fetch(new Request(`${origin}/api/demo`));
assert.equal(anonymous.status, 401);
const authenticated = await handler.fetch(
  new Request(`${origin}/api/demo`, {
    headers: {
      authorization: `Basic ${Buffer.from(`judge:${process.env.HOSTED_PASSWORD}`).toString("base64")}`,
    },
  }),
);
assert.equal(authenticated.status, 200);
process.env.ENABLE_LIVE_AI = "true";
const unsafe = await handler.fetch(new Request(`${origin}/api/health`));
assert.equal(unsafe.status, 503);
assert.deepEqual(await unsafe.json(), { error: "hosted_configuration_invalid" });
process.stdout.write(
  "Vercel build verified: static assets, emitted Node 24 handler, bundle exclusions, auth, origin policy, and fail-closed configuration. No model calls.\n",
);
