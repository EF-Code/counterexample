# Scoped repair proposals and isolated verification

## Browser workbench

The same curated example is now available in the browser. It is disabled by default.
Add `ENABLE_REPAIR_SANDBOX=true` to your local `.env` in your editor, then restart the
local server with `pnpm dev`. Docker and the local Node image are still required.

1. Run the billing fixture in the existing workbench.
2. In **Repair the curated billing example**, choose a reference proposal or live Nemotron.
3. Live mode separately requires consent to send the curated source and one billed request;
   the earlier promise-consent checkbox does not authorize source transmission.
4. Inspect the original/candidate code and exact diff. Check the review checkbox, then click
   **Approve and verify in Docker**. Proposal creation never automatically approves a candidate.
5. Inspect bounded verification results and download the diff, report, or repair bundle.

The repair bundle is **JSON containing named text files**, not a ZIP. Review and extract
the files into a new directory before running the Node test; normal host execution
privileges apply when run outside Docker. No original project file is replaced.

### Local web safety and lifecycle

- Repair routes accept only a proposal mode, source consent, opaque job ID/hash, and explicit
  approval. Clients cannot choose project paths, commands, images, models, API keys, or source code.
- Every state-changing/download request requires the process-local capability header.
  Existing loopback-host, same-origin, JSON content-type and body-size checks still apply.
- One repair operation can be active at a time; at most five proposal attempts per server run,
  including failed attempts. Completed verification is cached/idempotent.
- The UI drops stale responses and approval after the base promise/session is edited.
- Workspaces are private process-owned temporary directories, not public static files.
  They are removed on graceful server shutdown. Jobs/downloads do not survive restart.
- This capability is a local CSRF/admission control, **not production authentication**.
  Keep the server bound to loopback. Do not expose it through a reverse proxy or public
  tunnel without proper inbound auth, persistent quotas and deployment hardening.
- These quotas are not a provider spending cap; existing interpretation calls have a
  separate process-local limit. Live requests are never retried automatically.

The browser targets the authored fixture only, not an arbitrary uploaded repository or
every promise someone types. Reference-mode results remain clearly labeled.

This adds **proposal → human approval → candidate verification** for the authored,
single-purchase billing example. It does not deploy repairs or modify the original project.

## Supported correction

Only one operation is allowed: replace the one `provider.charge(null)` expression in
`service.ts` with a quoted stable `purchase:...` key. Model output is typed patch data,
not arbitrary source, shell commands, or file paths. Missing/ambiguous anchors are refused.

The profile assumes one fresh purchase and an always-committing fake $25 gateway. A constant
key is suitable only for this single-intent fixture, **not production multi-purchase billing**.
Async adapters and external package dependencies are unsupported.

## Requirements

- Node 24+ and access to a working local Docker daemon.
- A trusted local `node:24-alpine` image. No image is pulled automatically by the runner.
  If needed, install it explicitly with `docker pull node:24-alpine`.
- A project containing `service.ts` and `counterexample.adapter.ts`. Only these source files,
  the canonical runtime/verifier, and generated test helpers enter execution stages.

The actual image ID is recorded and pinned for candidate execution. Updating Counterexample's
runtime/verifier requires regenerating the proposal.

## Reference demonstration: no model call

From the project root:

```sh
npx --yes pnpm@12.10.1 repair propose \
  --project examples/billing-service \
  --output artifacts/repair-proposal
```

This reproduces the buggy baseline in Docker and creates a **reference-only** proposal,
not an AI-generated correction. Expected baseline: two charges and 285 violating schedules
out of 780. Review `proposal.json`, `change.diff`, and the captured source files.

No candidate executes automatically. After review:

```sh
npx --yes pnpm@12.10.1 repair verify \
  --proposal artifacts/repair-proposal \
  --output artifacts/repair-candidate \
  --approve
```

The candidate directory contains the corrected source copy, runnable Node regression,
and `verification.json`. The original example remains buggy and unchanged.
Output directories must be new. Failed jobs can leave private partial artifacts for
inspection; use a fresh path rather than overwriting them.

## Live NVIDIA/Nebius proposal

Configure `NEBIUS_API_KEY`, a supported `NEBIUS_MODEL`, and `ENABLE_LIVE_AI=true` in the
local gitignored `.env`. Explicitly consent to transmitting source:

```sh
npx --yes pnpm@12.10.1 repair propose \
  --project examples/billing-service \
  --output artifacts/repair-live-proposal \
  --live --consent-send-source
```

**This makes one billed request.** The service source and captured failure are sent;
the full additional schedule list is withheld from the request. Do not use source containing
secrets, personal information, or code you lack permission to share.

The model may propose the allowed correction or abstain. Refusal, malformed/truncated output,
unknown fields, invalid keys, and extra operations fail closed. No automatic retry or silent
reference fallback occurs. API credentials stay on the host and are not placed in container
arguments, source mounts, or proposal artifacts. Review before the separate approval command.

Model IDs/token usage record the API response, not a cryptographic attestation of provenance.

## Acceptance checks

A candidate is accepted only when executed checks establish:

1. The original five-event trace passes with exactly one committed purchase.
2. Repeating that trace produces the same result.
3. All 780 schedules of lengths one through four produce no duplicate-charge violation.
4. Every payment-containing schedule exercises the gateway; no-op billing is rejected.
5. The generated regression succeeds in a separate hardened container.

The additional schedules are withheld from model input, not secret from readers of this
open-source verifier. Finite checks are **not an unbounded correctness proof**.
Snapshot hashes reject edits, and runtime/verifier identity is anchored to Counterexample's
own tools rather than artifact-supplied hashes alone. Records are not signed or hardware-attested.
Malicious original source may try to subvert the in-process JavaScript verifier; review source
and do not treat this as an adversarial audit service.

## Container boundary

Every execution uses:

- No external network; read-only root filesystem and staged source bind mount.
- UID/GID 65534, all capabilities dropped, and `no-new-privileges`.
- 256 MiB container memory with no additional swap allowance, one CPU, 64 PIDs,
  and a 128 MiB V8 heap setting.
- A 64 MiB `/tmp` tmpfs with `noexec,nosuid`, 256 KiB output limit, and 15-second deadline.
- No repository-root mount, `.env` mount, Docker socket, or forwarded host credentials.
- Automatic removal on success and removal of the exact owned container after failure/timeout.

Containers share the host kernel. This is a hardened local boundary, **not an absolute
security guarantee or a VM for hostile third-party research**. Use a dedicated VM/service
boundary before accepting arbitrary untrusted repositories.

The existing `repository --trust-local-code` command still runs a normal host subprocess.
Exported tests also have normal process privileges if invoked manually outside Docker.

## Verification

```sh
npx --yes pnpm@12.10.1 check
npx --yes pnpm@12.10.1 test:sandbox
```

The ordinary suite skips Docker-dependent cases. `test:sandbox` runs real container tests
for credential/mount/network isolation, timeout cleanup, snapshot edits, verifier substitution,
and no-op rejection. Model tests use a local HTTP stand-in, not paid Nebius inference.
Generic repository repair and automatic application remain out of scope.
