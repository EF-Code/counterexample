# Local billing adapters and regression export

This milestone connects Counterexample to a reviewed local module instead of selecting
only a built-in workflow. It exports an actual property regression that fails on the
observed bug and passes when the implementation is corrected.

## Safety boundary

**Only run code you have reviewed and trust.** The CLI requires `--trust-local-code`
before importing an adapter. The browser API cannot supply an adapter path or execute it.

Adapters run in a subprocess with a five-second timeout, a 128 MiB V8 heap ceiling,
a 256 KiB stdout/stderr limit, and a 100-provider-call budget per replay. The subprocess
does not inherit environment credentials, including the Nebius key or `NODE_OPTIONS`.
These are operational limits, **not a security sandbox**: code still has the current user's
filesystem/network privileges and could access local files or start subprocesses. Do not
use this to run untrusted downloads. No package installation or real payment calls are needed.

The exported Node test imports the adapter directly. It also requires trusted code and
normal local/CI execution precautions; it does not inherit the CLI worker's process limits.

## Run the authored example

From the Counterexample root:

```sh
npx --yes pnpm@12.10.1 repository \
  --adapter examples/billing-service/counterexample.adapter.ts \
  --trust-local-code
```

The default schedule is `observe,charge_timeout,restart,observe,retry`. The authored
example retries a payment without a stable provider key. Expected: two $25 charges and
the reduced sequence `charge_timeout,retry`.

Compare the hand-authored control:

```sh
npx --yes pnpm@12.10.1 repository \
  --adapter examples/billing-service/fixed.adapter.ts \
  --trust-local-code
```

Expected: one charge and a passing promise for that schedule. These examples were authored
for this project; they are not independently discovered third-party vulnerabilities or AI repairs.

## Export a reusable regression

```sh
npx --yes pnpm@12.10.1 repository \
  --adapter examples/billing-service/counterexample.adapter.ts \
  --trust-local-code \
  --output artifacts/billing-regression

node --test artifacts/billing-regression/counterexample.test.ts
```

The second command is **expected to fail** while the bug remains. Exit status 1 means
the captured property was violated. Do not weaken the assertion to turn this green.

The new output directory contains:

- `counterexample.test.ts`: Node's built-in test runner; no Vitest dependency.
- `counterexample.runtime.ts`: a dependency-free copy of the canonical replay runtime.
- `evidence.json`: original/reduced traces, adapter reference, and export-time source hashes.
- `package.json`: ESM configuration for native TypeScript execution.
- `README.md`: how to run and interpret the regression.

Node 24+ is required. Counterexample itself need not be installed in the target repository.
The adapter and its own dependencies must remain reachable at the recorded relative paths.
Moving only the export folder is not sufficient if that breaks its adapter imports.

The test checks both the promise and one committed purchase under the always-committing
fake gateway. Disabling billing entirely is not a valid fix. The output folder must be new:
existing directories are refused, including empty ones, to avoid overwriting user files.
Passing traces are not exported as counterexamples.

## Adapter contract

Export `createWorkflow(provider)`. It must return a fresh worker with synchronous
`attempt(): void`. The worker may use closure variables or object-method `this` state.
Each `restart` constructs a fresh worker; provider records survive.

```ts
type PaymentGateway = {
  readonly charge: (key: string | null) => "acknowledged" | "timed_out";
};

export function createWorkflow(provider: PaymentGateway) {
  let acknowledged = false;
  return {
    attempt() {
      if (acknowledged) return;
      acknowledged = provider.charge("purchase:one") === "acknowledged";
    },
  };
}
```

Route your service's payment operation through the supplied provider. `null` means no
idempotency key; a nonempty key of at most 200 characters deduplicates at the fake provider.
Every committed charge is $25 and belongs to one purchase intent. `charge_timeout` commits
but returns `timed_out`; other payment actions return `acknowledged`. Provider calls during
worker construction or outside `attempt()` are rejected. Promise-returning factories and
attempts are unsupported; this version is not an async/distributed-system runner.

Supported module extensions: `.ts`, `.mts`, `.js`, `.mjs`, subject to native Node syntax and
your repository's module configuration. No compiler, shell command, or package install is inferred.

Choose a different bounded schedule with:

```sh
npx --yes pnpm@12.10.1 repository \
  --adapter examples/billing-service/counterexample.adapter.ts \
  --trust-local-code --actions charge,restart,retry
```

## Evidence limits

- The adapter entry hash is captured at export time, not a signed execution snapshot.
  It does not cover transitive imports or the whole repository.
- Reduction is minimal under single-action deletion, not necessarily globally shortest.
- The adapter must faithfully route the relevant service path through the injected provider.
  A passing schedule alone does not establish that the wiring is representative.
- This CLI analyzes the supplied schedule; it does not automatically discover arbitrary
  repository architecture, prove unbounded correctness, or generate a patch.
- No NVIDIA call is made by this CLI. The existing browser's Nebius interpretation remains
  the runtime AI integration; a repository run must use a separately reviewed property.
