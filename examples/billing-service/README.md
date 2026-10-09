# Authored billing integration example

`service.ts` deliberately loses payment certainty after a commit-before-timeout response.
`counterexample.adapter.ts` exposes the actual service factory to the replay runtime.
`fixed.adapter.ts` is a hand-authored stable-key reference control.

The module has no runtime dependencies or real payment credentials. It demonstrates the
repository adapter seam, not an independently discovered production bug or an AI-generated repair.

See [the adapter guide](../../docs/repository-adapters.md) for commands and execution limits.
