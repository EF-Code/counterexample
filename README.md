# Counterexample

**Make product promises executable.** Built with NVIDIA Nemotron on Nebius Token Factory.

Counterexample is a browser workbench for turning reviewed business promises into
reproducible failure evidence. The first slice models one purchase intent: a payment
commits, its response times out, and a retry charges the customer twice.

## What works today

- Deterministic replay of a billing fixture, including commit-before-timeout and worker restart.
- A hand-authored idempotent reference control using a stable provider key.
- Exhaustive bounded schedule exploration (five actions, maximum depth four).
- Single-deletion-minimal counterexample reduction and downloadable JSON evidence.
- Explicitly trusted local billing adapters and runnable Node regression-test export.
- Restricted repair proposals, explicit approval, and Docker-backed candidate verification.
- Server-side Nebius/NVIDIA promise interpretation with typed output and mandatory human review.
- Explicit inference opt-in, request consent, 30-second timeout, no automatic retries,
  and a ten-attempt inference limit per local server process.
- Vercel frontend/API deployment with exact-origin checks, optional demo authentication,
  and mandatory authentication plus durable request budgets for hosted live interpretation.

This is **not yet the full hackathon product**. The local CLI supports one synchronous
billing adapter profile, not arbitrary repository discovery or general autonomous code repair. The fixture does
not execute uploaded code and does not constitute a sandbox.

## Setup

Requires **Node 24.x**. Node's native TypeScript support runs the application; no transpiler
or global tool installation is required. pnpm is the package manager. If it is not installed,
use the `npx` commands below. Dependencies are locked in `pnpm-lock.yaml`.

```sh
npx --yes pnpm@12.10.1 install --frozen-lockfile
npx --yes pnpm@12.10.1 demo
npx --yes pnpm@12.10.1 check
npx --yes pnpm@12.10.1 dev
```

The application binds to **127.0.0.1:3000**, not a public interface. Open that URL to use
the browser workbench. Start without a key to use the labeled offline fixture and all
deterministic endpoints. `dev` builds the browser assets before starting the server.
For frontend edits, run `build:watch` in a second terminal and refresh after rebuilding.
Non-loopback hosts and cross-origin browser requests are rejected; POST requests require
`application/json`. The separate Vercel entrypoint uses explicitly trusted HTTPS origins.
`PORT=0` selects an OS-assigned ephemeral port for isolated runs and tests.

## Deploy on Vercel

See [Vercel deployment](docs/vercel-deployment.md) for the deployment configuration,
environment checklist, preview verification, and authentication entry URL.
The Vercel build serves `dist/client` and routes `/api/*` to a Node 24 function.
The default hosted mode supports the offline fixture without a model key. Live interpretation
requires server-side Nebius credentials, demo authentication, and an Upstash Redis budget.
**Fresh Docker repair verification is not available on Vercel**; it remains a local workflow
until a separate authenticated worker is implemented and provisioned. No public deployment
has been performed by these changes.

## Browser workflow

1. Enter a promise. Check transmission consent, then click **Interpret with Nemotron**.
2. Review the meaning, property, scope, model ID, and token usage.
3. Click **Approve this meaning**, then **Run billing fixture**. Unsupported meanings have
   no approval path. Editing the promise clears previous approval and visible evidence.
4. Compare the vulnerable and hand-authored reference receipts. Switch between full and
   reduced traces, expand bounded-search limitations, or download the evidence JSON.

**Try offline fixture** makes no AI call. It resets the promise to the supplied sample,
uses explicitly labeled fixture meaning, and executes the same real deterministic backend.
It does not imply that a custom promise was interpreted offline.

## Local repository integration

The CLI can analyze a reviewed local billing adapter and export a reusable Node regression
test. It requires an explicit trust flag and never accepts code paths through the browser API.
Its subprocess limits are **not a security sandbox**. See
[the adapter and regression guide](docs/repository-adapters.md) for the contract, authored
example, commands, failure semantics, and execution precautions.

## Scoped repair workflow

The authored billing example supports a narrow repair proposal: a stable charge key,
reviewed separately before candidate execution. Verification runs copied sources in a
hardened Docker container and checks the captured trace, 780 additional bounded schedules,
and the exported regression. Original files are untouched. Default proposals are labeled
reference data; live Nebius proposals require explicit source-sharing consent and environment opt-in.

See [the scoped repair guide](docs/repair-workflow.md) for commands, prerequisites, and
container/verification limits. The curated browser repair flow is available behind
`ENABLE_REPAIR_SANDBOX=true`; it is off by default and requires explicit source consent
for live proposals plus separate candidate approval. Routes are local/capability-gated,
not a public arbitrary-code execution service. See the guide before enabling or exposing it.

The API key stays server-side. Responses are parsed into typed values, and model prose is
rendered as text rather than HTML. Only fixed built assets are served; repository source
and credential files are not part of the public surface.

The component showcase is available at `/primitives.html`.

### Enable live Nebius inference

Create a local `.env` using `.env.example` as a template. Set these values in your editor:

```dotenv
NEBIUS_API_KEY=your-real-key-here
NEBIUS_MODEL=nvidia/nemotron-3-super-120b-a12b
ENABLE_LIVE_AI=true
PORT=3000
NODE_ENV=development
```

`.env` and `.env.*` are ignored except for the safe `.env.example`. Never paste keys into
chat, screenshots, shell command arguments, frontend code, logs, or git. Restart the
server after changing environment settings. `ENABLE_LIVE_AI=true` permits billed requests;
the ten-attempt guard is not a provider spending cap and resets on process restart.

Supported model IDs are explicitly allowlisted in `src/promise.ts`. The adapter uses
`https://api.tokenfactory.nebius.com/v1/chat/completions`, JSON-object output, and Zod
validation. Model/JSON-mode availability must be checked against your actual account.
Invalid, truncated, or refused output causes an error, never a fabricated interpretation.

Interpretation sends the submitted promise to Nebius. An explicitly requested live repair
also sends the curated service source and captured failure after separate source consent.
Do not include secrets, personal/customer information, or code you lack permission to share.
Live access is **not** exercised by the automated test suite.

## Try the API

### Complete deterministic demonstration

```sh
curl http://127.0.0.1:3000/api/demo
```

Expected evidence:

- Reduced schedule: `charge_timeout`, `retry`.
- Vulnerable fixture: two successful $25 charges; promise violated.
- Idempotent reference: one successful $25 charge; promise holds for that schedule.
- Depth-four exploration: 780 schedules per fixture, 285 violating schedules for the
  vulnerable fixture and zero for the reference. These are fixture results, not claims
  about real payment providers or unseen repositories.

### Replay a schedule

```sh
curl http://127.0.0.1:3000/api/replay \
  -H 'Content-Type: application/json' \
  -d '{"workflow":"vulnerable","actions":["charge_timeout","restart","retry"]}'
```

Use `"idempotent"` for the control. All actions refer to **the same purchase intent**:

| Action | Meaning |
| --- | --- |
| `charge` | Attempt payment and receive acknowledgement |
| `charge_timeout` | Provider commits payment, but the caller receives a timeout |
| `retry` | Attempt the same purchase again |
| `restart` | Lose worker-local acknowledgement state; provider records survive |
| `observe` | Observe state without modifying it |

### Find or reduce a failure

```sh
curl http://127.0.0.1:3000/api/explore \
  -H 'Content-Type: application/json' \
  -d '{"workflow":"vulnerable","maxDepth":4}'

curl http://127.0.0.1:3000/api/minimize \
  -H 'Content-Type: application/json' \
  -d '{"workflow":"vulnerable","actions":["observe","charge_timeout","restart","retry"]}'
```

### Interpret a promise through NVIDIA Nemotron

```sh
curl http://127.0.0.1:3000/api/interpret \
  -H 'Content-Type: application/json' \
  -d '{"promise":"Never charge twice for the same purchase, even after timeout and retry.","consentToSend":true}'
```

Interpretation is separate from execution. Review the returned meaning yourself before
using the fixture endpoints. At this stage the only supported property is
`at_most_one_charge_per_intent`. Cancellation, refunds, other domains, and ambiguous or
broader promises should be returned as unsupported. Schema validation does not establish
that a model interpreted the promise correctly.

`GET /api/health` reports configuration presence and selected model, **not** live connectivity.

## Architecture

```text
Promise -> Nebius/NVIDIA -> typed interpretation -> human review
                                                  |
Reviewed fixed property -> deterministic fixture -> trace -> reduction -> evidence
```

| Module | Responsibility |
| --- | --- |
| `src/domain.ts` | Replay contract and action schemas |
| `src/engine.ts` | Worker/provider fixture execution |
| `src/search.ts` | Bounded enumeration and deletion reduction |
| `src/evidence.ts` | Demonstration evidence bundle |
| `src/promise.ts` | Interpretation contract and allowed NVIDIA models |
| `src/nebius.ts` | Token Factory wire adapter |
| `src/app.ts` | Validated HTTP boundaries and inference gate |

## Verification and limitations

Tests cover the failing fixture, fixed controls, replay determinism, reduction, bounded
search, real local HTTP routes, and a local HTTP stand-in for Nebius. No real API key is
needed and no paid calls run during tests. `check` runs strict type checking, Biome, and Vitest.

Browser tests launch an isolated server on an OS-assigned port, disable live inference,
and mock only the inference boundary. They verify approval/consent, edit invalidation,
downloads, error recovery, unsafe-text rendering, and responsive accessibility. Evidence
captures and the HTML report are generated under gitignored `artifacts/`.

```sh
npx --yes pnpm@12.10.1 exec playwright install chromium
npx --yes pnpm@12.10.1 test:e2e
```

If using a system Chromium instead of Playwright's download:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npx --yes pnpm@12.10.1 test:e2e
```

Tests build production assets automatically. Accessibility scans do not replace real
screen-reader and disabled-user testing.

Run a production-build Lighthouse audit through a Playwright-launched Chromium instance:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npx --yes pnpm@12.10.1 run audit:ui
```

Omit the executable override to use Playwright's downloaded browser. This starts an
isolated, inference-disabled local server, uses OS-assigned ports, and saves three mobile
and three desktop reports under `artifacts/lighthouse/`. It does not invoke the Lighthouse
CLI or audit a development server. Local scores do not predict deployed-network performance.
Use `pnpm audit` separately for dependency advisories.

Provider idempotency expiration, multiple intents, concurrent workers, real queue timing,
and production payment APIs are not modeled. Reduction is minimal under removal of one
action, not guaranteed globally shortest. Passing a finite search is not formal proof.

Do not expose this server publicly yet: the local capability is not production authentication,
and durable quotas/deployment controls are absent. Restricted candidate copies are already
verified in hardened Docker containers; arbitrary repository repair and adversarial execution
require a stronger operational boundary. Fresh live repair evidence and independent benchmarks
remain submission-readiness work. Containers share the host kernel and are not a VM guarantee.

## Next milestones

1. Validate live model access and interpretation accuracy on reviewed promise paraphrases.
2. Extend the working browser event timeline to new, independently reviewed properties.
3. Add cancellation and refund properties with reviewed semantics and independent controls.
4. Validate the working repository adapter and regression export on an independently authored project.
5. Extend the working isolated repair profile and validate it with an independently authored benchmark.

## Submission preparation

- [Devpost narrative and readiness checklist](docs/submission.md)
- [Three-minute demo storyboard](docs/demo-video.md)
- [Judging-period hosting choices and blockers](docs/hosting-plan.md)

Generate a fixture-only evidence packet to a **new** directory:

```sh
npx --yes pnpm@12.10.1 submission:evidence --output artifacts/submission-packet
```

Add `--sandbox` to rehearse the known reference repair in Docker. This command does not load
`.env`, make a model request, publish anything, run the test suite, or claim independent findings.
It is not a universal secret scanner; review generated snapshots before sharing them.

## Hackathon notes

The NVIDIA integration is runtime promise interpretation through Nebius Token Factory,
not merely use of an AI coding assistant. Record actual model IDs, latency, token usage,
and observed failure categories for the required platform feedback. Keep the eventual
hosted demo accessible during judging and publish the submission repository yourself.

References: [Nebius text generation](https://docs.tokenfactory.nebius.com/api-reference/examples/text-generation),
[structured output](https://docs.tokenfactory.nebius.com/ai-models-inference/json),
[model catalog](https://tokenfactory.nebius.com/model-catalog.md).

## License

[MIT](LICENSE).
