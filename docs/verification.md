# Browser workbench verification

## Authorized publication and preview deployment

- Published MIT source to https://github.com/EF-Code/counterexample on `master`.
  A redacted staged Gitleaks scan found no leaks; real `.env` files, `.vercel/`, local artifacts,
  dependencies, and build output were excluded from Git publication.
- The first cloud install failed with `ERR_PNPM_IGNORED_BUILDS`. Added a version-specific
  esbuild 0.28.2 script approval in `pnpm-workspace.yaml`; other scripts remain unapproved.
- Application revision `3b1425d` deployed successfully from source to the
  [Vercel preview](https://counterexample-97o56zngp-ef-code-projects.vercel.app).
  Vercel reported **Ready**, Node 24 function, and successful fresh pnpm 12.10.1 install/build.
- Actual hosted `/api/health`, `/api/demo`, and `/api/repair/session` returned correct JSON.
  Health confirmed no model key/live inference; repair confirmed disabled with a null token.
- Chromium smoke passed for real hosted HTML, JavaScript, CSS, fonts, favicon, fixture results,
  and evidence download. Protected preview responses were forwarded by authenticated
  `vercel curl`, not mocked. This does not test a user's Vercel login or unauthenticated access.
- [GitHub CI](https://github.com/EF-Code/counterexample/actions/runs/37927912823) passed
  clean install, types/lint/build/tests, browser tests, and opt-in Docker tests on the deployed
  application revision. Later publication-status documentation commits do not change application code.
- Deployment protection remains enabled. No production deployment, model credentials,
  paid inference call, or separate Docker worker was introduced. Judging access remains open.

## Vercel deployment-preparation milestone

- Added a separate Web Standard API handler, exact trusted HTTPS origins, CDN asset output,
  pinned Node 24/pnpm install/build, function/upload exclusions, and opt-in demo Basic Auth.
- Offline hosted fixture works without provider credentials. Hosted live interpretation
  requires authentication, model credentials, and an atomic Upstash-compatible Redis budget.
- Real local Redis tests exercise the Lua script through an HTTP REST shim: concurrent
  reservations, lifetime-cap persistence, short-window cap, and fail-closed credential rejection.
  This is not a request to the actual Upstash service or a paid Nebius smoke test.
- Vercel build succeeded on Node 24.20.0. Executing the emitted handler caught and fixed
  TypeScript import-extension emission and accidental local artifact tracing. The packaged
  verifier now passes runtime/route metadata, exclusions, fixture, auth, origins, and unsafe-config checks.
- Final Node 24.20.0 quality gates: strict types, Biome, production build, **118 ordinary
  tests**, and **13 opt-in real-Docker tests passed**. The default suite skips the Docker tests.
- An existing repository CLI test hit its five-second outer deadline during concurrent
  verification; its subprocess deadlines were ten plus five seconds. The test deadline
  now allows those bounded operations and cleanup (20 seconds); no retries or sleeps were
  added. Isolation and the subsequent full suite passed.
- **20 existing Chromium browser tests passed** after the shared API changes.
- Packaged frontend browser smoke passed: authenticated `/api/access` navigation, actual
  fixture evidence, evidence download, and disabled repair. HTTPS API origin is simulated
  behind a loopback server; external Vercel routing/TLS/login remain preview acceptance checks.
- Independent goal, security, code-quality, and documentation reviews found no blockers for
  the offline hosted scope. QA accepted code readiness conditionally on the Docker quota
  suite (executed and passed), while retaining external deployment/live-provider limitations.
- Fresh Docker repair remains deliberately unavailable on Vercel; the local workflow is
  preserved. No separate worker, hosted Redis database, credentials, or public deployment
  was provisioned. No developer `.env` was edited or copied into Vercel settings.

## Submission-preparation milestone

- Added a fixture-only packet generator and explicit optional Docker reference rehearsal.
- **89 ordinary tests passed**, with 9 Docker cases skipped by default.
- **9 real-Docker tests passed**, including packet rehearsal and real candidate acceptance.
- Strict types, lint and production build passed. No UI source changed in this milestone.
- Generated `artifacts/submission-packet-demo/`: authored-fixture evidence, metadata/hash,
  reference proposal/candidate, and runbook. It claims neither live AI nor test-suite execution.
- The command copies no `.env`, web-capability tokens, logs, or private web-job directories.
  It is not a universal secret scanner; generated source snapshots need review before publication.
- Existing `my-live-proposal` / `my-verified-candidate` records were inspected: matching
  Nemotron 3 Super IDs, 687/352/1039 token usage, accepted candidate, and 0/780 violations.
  No new paid request was made; these prior local records are not signed evidence or part
  of the freshly generated reference-only packet.
- Submission narrative, video storyboard and hosting blockers are drafted. No public
  deployment, repository publication/push, video upload, or Devpost submission was performed.
- Final targeted packaging verification on Node 24.20.0: **4 tests across 3 files passed**,
  including the actual CLI and opt-in real-Docker packet rehearsal.
- The initial independent packaging review timed out without a verdict. A bounded retry
  found no blockers in the packet generator, CLI, unit tests, submission draft, and hosting
  plan. It did not rerun tests or review the underlying snapshot/repair helpers.
- Follow-up inspection of those helpers confirmed exclusive output-directory creation,
  exclusive snapshot/report writes, and fixed-file source selection. Source snapshots are
  not scanned for embedded credentials; manual review before sharing remains required.

## Subsequent curated browser-repair milestone

The workbench now exposes the existing curated repair profile with explicit source consent,
code/diff review, hash-bound approval, verification results, and named-file JSON export.

- **86 ordinary tests passed**, with 8 Docker cases skipped by default.
- **8 real-Docker tests passed**, including the full capability-protected HTTP proposal/
  verification/export flow and idempotent repeated approval.
- **20 Chromium browser tests passed**. Repair UI responses are mocked at the network
  boundary; this is separate from real Docker HTTP integration evidence.
- Browser checks cover source consent, explicit approval, stale-response invalidation,
  pending/error recovery, JSON download labels, and responsive code/result layouts.
- **43 fresh PNGs**: the earlier 24 workbench/primitives states plus 18 repair
  ready/proposing/verifying/error/review/result captures across 375/768/1280px and one
  availability-failure/reload capture. A regression test locks persistence after fixture unlock.
- Axe scans found no violations on covered repair states; viewport overflow checks passed.
- Production-build Lighthouse: three mobile and three desktop runs. Medians are **100**
  for performance/accessibility/best-practices/SEO on each preset. Mobile performance
  final runs were 98/100/100; local results are not deployed-network guarantees.
- Repair code loads as a separate chunk when the fixture completes, using current session
  state after import. This reduced cold-page schema/controller initialization without
  removing controls or verification behavior; the complete browser suite passed afterward.
- Browser sandbox opt-in defaults off; capability header, single active job, five attempts,
  fixed curated project, strict request fields, and artifact allowlist preserve scope.
- Originals/credentials are not exposed to browser controls; temporary workspaces are
  removed during graceful server shutdown. No paid model calls were made during QA.

Independent final source-integrity review: **PASS**, no blockers for the curated local-only scope. Independent final visual review: **PASS**, all 43 current PNGs opened, including the availability-error/reload capture. No paid model calls were made during QA.

## Subsequent isolated repair milestone

The single-purchase billing profile now supports restricted proposals, explicit source-sharing
consent for live inference, separate approval, and execution of candidate copies in Docker.

- Ordinary suite: **77 tests passed**, with 7 Docker-dependent cases skipped by default.
- Explicit real-Docker suite: **7 tests passed** (isolation, deadline cleanup, source/hash
  edits, canonical verifier substitution, original preservation, and no-op rejection).
- Existing browser suite: **10 tests passed**; strict types, lint, production build, and
  frozen-lockfile installation passed. No new visual surface was introduced.
- Manual reference proposal/verification produced `artifacts/repair-proposal-demo/` and
  `artifacts/repair-candidate-demo/`. Baseline: two charges, 285/780 violating schedules.
  Candidate: one charge, 0/780 violations, generated regression passed, originals unchanged.
- Docker execution used the recorded local Node image ID, non-root UID, no network,
  read-only filesystem/stage, capability/resource limits, and owned-container cleanup.
  No labeled sandbox containers remained after verification.
- Independent source/flow review: **PASS**, no blockers for the explicitly restricted scope.
- No paid model calls were made during QA. Repair model responses were tested through a
  local HTTP stand-in; the manual demonstration was explicitly reference-mode, not AI output.
- Snapshot/runtime/verifier identities are checked, but records are not signed or
  hardware-attested. Containers share the host kernel; this is not a hostile-repository
  audit service, generic code repair, production billing patch, or unbounded proof.

See [the isolated repair workflow](repair-workflow.md) for live opt-in commands and limitations.

## Subsequent repository-adapter milestone

The provider-driven runtime now supports reviewed local synchronous billing modules and
exports runnable Node regressions through the explicit-trust CLI. This does not add a
repository-execution endpoint to the browser API or a security sandbox.

- Full verification: **65 Vitest tests passed**, strict types/lint/build passed, and the
  existing **10 browser tests passed** against the shared runtime.
- The **19 new adapter/export/CLI tests also passed on Node 24.20.0**, in addition to
  the full suite on Node 26.11.1.
- Exported tests execute without Counterexample or Vitest installed. They fail on the
  observed duplicate-charge bug, pass on the stable-key correction, and reject disabled billing.
- Worker tests verify credential non-inheritance, invalid/async contract rejection, and
  termination of stuck initialization at the five-second limit.
- CLI tests verify explicit trust before import, strict options, actual artifact export,
  and refusal to overwrite existing output directories.
- A reviewed example was executed and exported to `artifacts/billing-regression-demo/`.
  Its generated test was run and **failed as expected** with two successful charges.
- This is an authored integration example, not an independently discovered external bug.
- Independent adapter/export review: **PASS** with no blockers. The reviewer reran all
  65 tests, checked strict types/lint for the milestone, and manually analyzed the authored adapter.

See [repository adapters](repository-adapters.md) for commands and the precise execution limits.
The historical browser checks below describe the prior UI milestone; no new visual surface
was introduced by the CLI work.

## Implemented scope

Same-origin browser workbench for the existing deterministic billing fixture. Supports
live promise interpretation, explicit consent and meaning approval, offline sample mode,
full/reduced event traces, reference receipts, bounded-search disclosure, and JSON download.
No autonomous patch generation, arbitrary repository execution, or public deployment.

## Executed checks

- `pnpm check`: strict TypeScript, Biome, production build, **46 Vitest tests passed**.
- `pnpm test:e2e`: **10 Chromium browser tests passed**, isolated inference-disabled
  server on an OS-assigned port; model responses mocked at the browser network boundary.
- Responsive captures: **24 PNGs**, workbench and component showcase at 375/768/1280px.
  Includes empty, pending, review, approved, error, full trace, and reduced trace states.
- Axe: no violations on tested states, including the selected trace button while hovered.
- Editing clears approval/evidence; unsupported meaning has no approval action.
- Evidence downloads retain fixture/live interpretation provenance. HTML-like model text
  stays text; long Japanese content does not create horizontal overflow.
- Static tests keep `.env`, source modules and package manifests outside served routes.
- Frozen-lockfile installation passed. Dependency scan: **no known vulnerabilities**.

## Performance

Production assets, real Chromium launched through Playwright, Lighthouse Node API attached
to its OS-assigned debugging port. Three mobile and three desktop runs against an isolated
local server. No Lighthouse CLI, development server, hidden content or disabled features.

| Category | Mobile median | Desktop median |
| --- | ---: | ---: |
| Performance | 100 | 100 |
| Accessibility | 100 | 100 |
| Best practices | 100 | 100 |
| SEO | 100 | 100 |

Mobile performance runs were 99/100/100; all other final scores were 100. Static-asset gzip
raised the earlier mobile median from 97 to 100 without changing the rendered UI.
Reports are under `artifacts/lighthouse/`; screenshots and browser reports under `artifacts/`.
Local scores are not deployed performance measurements or accessibility certification.

## Fixes validated

- Selected trace button hover originally had 1.04:1 contrast. A regression check failed,
  selected-state styling was fixed, then the check passed at all tested widths.
- Mobile hidden line break originally joined `fixture.No`. Explicit whitespace fixes the
  sentence boundary, and all workbench captures were regenerated afterward.
- Vitest upgraded to patched 4.1.11 after dependency advisories were observed; full suite rerun.
- Oversized layout CSS split into shell and evidence responsibilities. Source modules all
  remain below 200 nonblank lines.

## Limits and remaining checks

- Browser-test inference is mocked; the user's successful curl response separately confirmed
  live Nebius/NVIDIA connectivity. QA made no paid inference calls.
- Automated checks are not real screen-reader, disabled-user, or production-user validation.
- Final independent source-integrity review: **PASS**, scoped to the browser-workbench
  milestone, with no code blockers. It did not re-execute the test suite; executed results
  above come from the main verification run.
- Final independent visual review: **PASS**, all 24 fresh PNGs opened. Mobile sentence
  spacing verified at every captured width and state, with no new visual blockers. Static
  captures do not establish live inference, screen-reader behavior, or deployed performance.
- Rollup reports two third-party Zod pure-annotation warnings; builds and tests succeed.
  Dependency source was not modified to hide these warnings.
