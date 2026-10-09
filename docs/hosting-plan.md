# Judging-period hosting plan

**Current status: protected offline Vercel preview deployed; no production deployment.**
The [preview](https://counterexample-97o56zngp-ef-code-projects.vercel.app) requires Vercel
Authentication. Fresh Docker repair remains local-only. The local loopback checks, capability
token, and process quotas are not a production access-control system.

The new [Vercel deployment entrypoint](vercel-deployment.md) is separate from the local
server. It packages the frontend and fixture API, with exact HTTPS origins and guarded live
interpretation. Fresh Docker repair is deliberately unavailable there. The cloud build and
offline API/browser checks passed; unauthenticated judging access and live-provider checks
remain open. Linking/building alone is not public deployment.

Previously retrieved schedule: judging December 1–15, 2026, winners around January 11, 2027.
Reconfirm dates and keep access valid; do not assume submission-day credits last through judging.

## Why a tunnel or proxy is not a deployment plan

- The app binds to `127.0.0.1` and validates loopback Host and same-origin requests.
- Blindly forwarding an external Host as localhost does not make origin checks or auth safe.
- `/api/repair/session` is a local capability bootstrap, not an identity/login endpoint.
- Quotas are memory-only and reset on process restart. They are not a billing spending cap.
- Docker control on a publicly reachable app is privileged infrastructure. Do not mount
  a Docker socket into a public web container or expose it over TCP to "make repair work".

## Options to choose before implementation

### A. Accessible test build + live demo video

Publish a reviewed release/test build with reproducible setup, alongside a real live video.
This avoids operating a public code runner but requires judges to have compatible Node,
Docker and model access. Confirm organizers accept the supplied test-build format and access
instructions. A localhost URL is not an accessible demo URL.

### B. Static recorded-evidence viewer

Build a separate read-only viewer for sanitized captured runs. It must clearly distinguish
recorded live evidence from freshly executed inference and reference fixtures. No API key,
Docker socket, or model proxy is shipped. The current Vite workbench is **not** standalone
static hosting: its `/api/*` calls need the backend. This viewer is a future feature, not built here.

### C. Authenticated hosted workbench

Potential strongest demonstration, but requires an explicit deployment decision and budget.
Use an authenticated frontend/API with exact trusted public origins, per-user durable quotas,
provider spending controls, and secret management. Separate execution from the public API
using dedicated worker/VM boundaries, job admission/deadline controls, and no host-root mounts.
Serve only reviewed curated projects initially. Do not silently disable existing checks.

Nebius Token Factory can remain the runtime model provider while other app components live
elsewhere. AI Cloud hosting is optional for the present architecture; no paid provisioning
or cloud-credit availability is assumed.

## Blocking decisions / acceptance checks

- [ ] User explicitly authorizes deployment, target account/provider, domain, and spend limit.
- [ ] Decide whether judges get a test build, replay viewer, or live authenticated app.
- [ ] Validate current hackathon/demo requirements with organizers.
- [ ] Provide inbound auth and exact origin policy before enabling remote live operations.
- [ ] Add persistent accounting, rate/admission controls, and provider billing safeguards.
- [ ] Separate sandbox workers from the public service and harden the operational boundary.
- [ ] Verify model access and image/runtime availability in the actual deployment.
- [ ] Test access from a clean external browser, without sharing developer credentials.
- [ ] Confirm expiration dates, downtime fallback labels, and access through the judging window.
- [ ] Re-measure deployed performance; localhost audit results are not deployment guarantees.

The initial planning milestone changed no infrastructure, DNS, tunnels, credentials, paid
service, or public GitHub setting. Subsequent authorization published the source repository
and created the protected preview above. No production deployment or sandbox worker was created.
