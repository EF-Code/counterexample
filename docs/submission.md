# Devpost submission draft and readiness checklist

**Status: draft, not submitted.** The MIT source repository is published and a protected offline
Vercel preview exists. Unauthenticated judging/test-build access, video, entrant eligibility,
and independent validation still need confirmation. Previously recorded
local live-repair artifacts exist and should be reviewed/selected for the final demonstration.

## Suggested title / track / pitch

**Counterexample — make product promises executable**

Best-fit track: **Coding and Agentic Engineering**.

Counterexample turns a reviewed product promise into an inspectable failure sequence and
a reusable regression test. NVIDIA Nemotron on Nebius Token Factory interprets the promise
and can propose a restricted correction. Deterministic execution—not an LLM judge—checks
the failure and candidate. The current prototype focuses on duplicate charges after an
ambiguous payment response or worker restart.

## Inspiration

"Never charge a customer twice" sounds straightforward. A happy-path test can pass while
a retry after a provider timeout breaks that promise: the payment already committed, but
the worker never received confirmation. We wanted the promise, breaking sequence, and
verification evidence to be visible in one product, rather than trust an AI explanation.

## What it does

- Interprets one supported business invariant with a real NVIDIA model through Nebius.
- Requires human review before fixture execution and separate approval before repair verification.
- Replays a fake payment provider, reduces a noisy failure to its causal sequence, and
  compares the vulnerable workflow against a hand-authored control.
- Supports a reviewed local synchronous adapter and exports a runnable Node regression.
- Offers reference or opt-in Nemotron repair proposals for the curated example.
- Verifies candidate copies in hardened Docker containers against the captured trace,
  repeatability, 780 additional bounded schedules, and the generated regression.
- Rejects no-op billing, unknown model operations, edited snapshots, and substituted verifiers.

## How it was built

Node 24+ / strict TypeScript, Hono API, vanilla TypeScript + Vite UI, Zod boundaries, ky
HTTP client, and NVIDIA Nemotron through Nebius Token Factory's chat-completions API.
API keys remain server-side. Containers have no external network, read-only staged source,
non-root execution, dropped capabilities, and resource/deadline limits. UI state invalidates
approval after edits and never treats a model proposal as execution evidence.

## Demonstrated results and scope

For the authored single-purchase fixture, the vulnerable workflow produces two $25 charges.
Its depth-four search finds **285 violating schedules / 780**; the stable-key candidate has
**0 / 780**, one committed purchase, and a passing generated regression. These are reproducible
fixture measurements, **not independent production findings or an unbounded proof**.

Current limits: one invariant, one intent, fixed $25 fake gateway, synchronous adapter profile,
restricted null-key correction, and local-only browser execution. A constant fixture key is
not a production multi-purchase solution. Docker shares the host kernel; no VM-level guarantee
or adversarial execution attestation is claimed. No original project is automatically modified.

## Challenges / lessons

- A property pass can be vacuous: disabling payment must not count as a fix.
- Source approval needs snapshot identity, not just an "approved" boolean.
- A late network response must not restore approval after the user edits the promise.
- Model abstention and invalid output must remain failures, not silently become reference data.
- The local capability token and quotas are not production authentication or provider spending caps.

## Required platform feedback — evidence-calibrated notes

Known live evidence: the user's successful Nemotron 3 Super interpretation reported
294 prompt tokens, 260 completion tokens, and 554 total tokens. This was user-provided
output, not a fresh submission-packet measurement. Do not invent latency or accuracy figures.

Existing local artifacts were also inspected: `artifacts/my-live-proposal/proposal.json`
records `source: nebius`, matching requested/response model
`nvidia/nemotron-3-super-120b-a12b`, and 687 prompt / 352 completion / 1039 total tokens.
`artifacts/my-verified-candidate/verification.json` records acceptance, a passing regression,
one charge, and 0/780 violating schedules on the same pinned image. These are previously
recorded local artifacts, not a fresh request made by the packet generator or signed attestation.
They were not automatically copied into the reference packet. Review them before sharing.

Before finalizing feedback, record first-hand details for the live interpretation and repair:
exact model ID, request role, response validity/abstention, token usage, latency measurement,
onboarding experience, account/model availability, and concrete tooling friction. Describe
what worked and failed. Docker/Node execution is local; do not claim Nebius GPU-cloud usage.
Free OpenCode development access is not the submitted app's runtime integration.

## Submission gates

- [ ] Confirm current official rules and entrant eligibility, including residence/affiliations.
- [ ] Reconfirm deadline. Previously retrieved page: **October 30, 2026, 10 a.m. PDT**.
- [ ] Confirm any pre-existing work was significantly updated during the submission window.
- [x] Publish the intended source repository with MIT license; clean GitHub CI setup passed.
- [x] Supply the public repository URL: https://github.com/EF-Code/counterexample.
- [ ] Provide an accessible working demo or test-build URL, not a localhost URL.
  Current preview: https://counterexample-97o56zngp-ef-code-projects.vercel.app — requires
  Vercel Authentication, so this gate remains open for judges without account access.
- [ ] Select/redact the recorded live proof, and capture a readable current demonstration with explicit consent.
- [ ] Upload a public YouTube demo within the event's duration limit (previously ≤3 minutes).
- [ ] Submit genuine platform feedback; no measured performance or adoption claims invented.
- [ ] Keep judges' access working through the judging period and verify credits/account expiry.
- [ ] Add independent project/user validation or explicitly disclose that it is absent.
- [ ] Test links/access without your login; never share the API key to make a demo work.

Official references: [overview](https://nebiusglobalaihackathon.devpost.com/),
[rules](https://nebiusglobalaihackathon.devpost.com/rules),
[FAQs](https://nebiusglobalaihackathon.devpost.com/details/faqs).
Cached earlier event text is not a guarantee of current requirements; recheck before entry.

## Evidence packet

```sh
npx --yes pnpm@12.10.1 submission:evidence --output artifacts/submission-packet --sandbox
```

This reference rehearsal makes no model calls, publishes nothing, and refuses existing
output folders. It exports fixture evidence, source hashes/runtime metadata, and optional
Docker verification. It does not copy `.env`, web-session tokens, logs, or private web workspaces,
and it is **not a universal secret scanner**. Review artifacts before sharing. The manifest
keeps live proof, automated test execution, public URLs, and remaining requirements explicit.
