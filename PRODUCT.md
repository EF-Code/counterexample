# Counterexample

Counterexample turns a reviewed business promise into reproducible failure evidence.
Audience: developers maintaining billing workflows; hackathon judges evaluating an actual
working system. The first surface is an Operate-mode browser workbench, not a landing page.

The supported prototype models one purchase intent, a fixed $25 charge, an ambiguous
commit-before-timeout result, and worker restart. NVIDIA Nemotron on Nebius interprets
the promise. Human approval must precede live-flow execution. Deterministic software,
not an LLM, evaluates the trace. The idempotent reference is hand-authored, not an AI repair.

Success: a developer can enter a promise, inspect and approve its interpretation, see
the exact duplicate-charge sequence, compare the reference control, and download evidence.
The offline demonstration is explicitly labeled and uses the supplied sample promise.
No inference runs automatically. Unsupported promises stop before execution.

Assumptions for this iteration: desktop-first engineering work in a normally lit workspace;
mobile must remain fully usable; a small vanilla TypeScript UI is sufficient. These are
implementation choices, not user research results. Existing local API and security controls
must remain compatible; no public hosting, credentials in the browser, or arbitrary code execution.
