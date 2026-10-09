# Vercel deployment

## Supported deployment scope

The existing Vite frontend and lightweight Hono API can be deployed together. `vercel.json`
selects `dist/client`, Node 24 is pinned in `package.json`, and `/api/*` rewrites to
`api/index.ts`, a Web Standard `fetch` handler. The function does not start a local listener.
Corepack uses the pinned pnpm 12.10.1 for the main install/build. If Vercel's build image
requires Corepack opt-in, set `ENABLE_EXPERIMENTAL_COREPACK=1` in project build settings.

Default: offline fixture replay, bounded exploration, reduction, and evidence downloads.
Optional: authenticated live NVIDIA/Nebius promise interpretation.
Unavailable: fresh repair proposal/approval/Docker verification on Vercel. The existing
frontend receives `enabled:false` and no repair capability token; local CLI/browser repair
continues unchanged. A separate worker is not implemented or provisioned by this milestone.

This is a restricted hackathon demo, not a public arbitrary-code execution service or a
multi-user production billing product. Basic Auth is shared demo access, not identity,
per-user accounting, or full production authentication. Use HTTPS and share access separately
with judges; never share the Nebius or Redis credential.

## Environment settings

No developer `.env` is uploaded or copied into Vercel. The Vercel project currently has no
app credentials configured. Configure values through the Vercel dashboard or interactive
`vercel env add`; do not put secrets in command-line arguments, `vercel.json`, or `VITE_*`.

| Variable | Offline mode | Live interpretation |
| --- | --- | --- |
| `ENABLE_LIVE_AI` | Omit or `false` | `true` |
| `ENABLE_REPAIR_SANDBOX` | Omit or `false` | Must remain `false` |
| `APP_PUBLIC_ORIGINS` | Optional comma-separated exact HTTPS origins for custom aliases | Same |
| `HOSTED_USERNAME` | Optional, requires password too | Required; letters/digits/underscore/hyphen |
| `HOSTED_PASSWORD` | Optional, requires username too | Required; 32–256 characters, randomly generated |
| `NEBIUS_API_KEY` | Not required | Required, server-side only |
| `NEBIUS_MODEL` | Existing default | Supported NVIDIA model; existing default if omitted |
| `UPSTASH_REDIS_REST_URL` | Not required | Required HTTPS `*.upstash.io` endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Not required | Required write-capable Redis token |
| `HOSTED_QUOTA_NAMESPACE` | Not required | Required stable ledger name, 1–64 letters/digits/underscore/hyphen |
| `HOSTED_TOTAL_CALL_LIMIT` | Not required | Default `100`; integer 1–10000 |
| `HOSTED_MINUTE_CALL_LIMIT` | Not required | Default `5`; integer 1–60 |

Vercel's system `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL` supply exact trusted HTTPS
origins automatically. Do not disable system environment variables. Add other custom aliases
explicitly through `APP_PUBLIC_ORIGINS`. Wildcards, HTTP, paths, URL credentials, query strings,
and fragments are rejected. Forwarded-host headers cannot add trust. Cross-origin requests
remain blocked; JSON and body-size validation remain in force.

Live mode with missing authentication, model key, or Redis settings fails closed with
`503 hosted_configuration_invalid`. An incomplete optional offline credential pair also fails.

When demo authentication is enabled, share `https://YOUR_HOST/api/access` as the entry URL.
This browser navigation prompts for Basic Auth in the `/api/` scope, then redirects to the
frontend. Authenticated API responses are `no-store`. Static frontend assets remain public;
they contain no authentication credentials. Use a private browsing window to clear cached
Basic Auth credentials. Verify this login flow in the actual preview browser before sharing.

## Durable admission and cost limits

Each valid, authenticated live interpretation atomically reserves a slot in Redis before
calling Nebius. Redis Lua checks both the lifetime total and a 60-second short window in
one operation. The total key has **no expiry**; the short-window key expires. Independent
function instances share the limits when they use the same database and namespace.
Exhaustion returns `429 hosted_inference_limit`; unavailable/invalid quota responses return
`503 inference_budget_unavailable`. There is no permissive fallback, automatic quota retry,
or refund after a failed model call. Invalid request bodies do not reserve slots.

Keep the same namespace across redeployments and all deployments sharing a spending pool.
Separate namespaces grant separate budgets. Deleting/flushing the database, changing namespace,
or losing Redis data resets the ledger. Do not treat the ledger as tamper-proof accounting.
Choose a persistent Redis database, not an expiring test database, for the judging period.

This is a **request cap, not a dollar cap**. Input length is bounded, output is capped at
1024 tokens, and inference has no automatic retry, but provider prices vary. Set a provider
spending cap if available and choose a total request allowance compatible with your budget.
Vercel/Redis usage can incur charges independently; free hosting does not make inference free.

## Verification before publishing

Use Node 24 and the existing linked project. If `pnpm` is not on your PATH, the combined
`npx` invocation below makes it available to Vercel's function builder as well as the main build:

```sh
npx --yes pnpm@12.10.1 check
docker pull node:24-alpine
docker pull redis:7-alpine
npx --yes pnpm@12.10.1 test:sandbox
npx --yes --package=pnpm@12.10.1 --package=vercel@63.1.0 vercel build --yes
node scripts/verify-vercel-build.mjs
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node scripts/verify-vercel-browser.mjs
```

The build can fetch linked project settings and write cached environment files under ignored
`.vercel/`. It does not deploy. The verifier executes the emitted function with test-only
configuration, checks runtime/route metadata and bundle exclusions, exercises fixture/auth/origin
behavior, and confirms incomplete live settings are rejected. It makes no paid model calls.
It is not a universal secret scanner or an external Vercel routing test.
The browser smoke uses the packaged frontend and emitted function with test-only Basic Auth,
checks login navigation, fixture evidence/download, and disabled repair, and makes no paid
request. It simulates the configured HTTPS API origin behind a loopback server; it does not
establish external Vercel rewrite behavior, TLS, custom-domain correctness, or live inference.

Only after explicit deployment authorization, deploy a **preview**, keeping Vercel deployment
protection enabled. Validate from a clean external browser:

- Root HTML, JavaScript, fonts, and favicon load without redirects or missing assets.
- `/api/health` and `/api/demo` return JSON, not the HTML entrypoint or a route 404.
- Offline fixture replay and evidence download work; fresh repair is visibly unavailable.
- If protected, `/api/access` prompts correctly and subsequent frontend API requests authenticate.
- Foreign-host/cross-origin requests and unsupported/oversized bodies are denied.
- If live mode is chosen, verify Redis admission first; perform a consented paid model request
  only with permission and verify provider identity/usage without logging credentials.
- Test quota exhaustion/outages against a dedicated test ledger, never by resetting production.
- Check custom domains, credentials, budgets, service expiry, and judging-period availability.

Production deployment and paid live smoke tests have not been performed. Deployment readiness
for the offline scope is not proof of a successful cloud deployment or live provider configuration.
