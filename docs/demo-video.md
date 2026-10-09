# Three-minute demonstration storyboard

Target **2:50**, leaving margin below the previously published three-minute cap. Use the real
browser workflow. Do not present mocked screenshots or reference-mode data as live AI output.

## Pre-recording checklist

1. Run `pnpm check`, `pnpm test:sandbox`, and `pnpm test:e2e` on the recording build.
2. Verify Docker and the local Node image. Set repair opt-in locally; keep loopback binding.
3. Confirm live model access, credits, and consent before a billed request. Do not expose `.env`,
   request Authorization headers, capability tokens, or customer/private source.
4. Rehearse the actual model latency and abstention behavior. The packet generator is reference-only.
5. Use the authored public fixture. Keep the display readable; zoom code/diff during review.
6. If editing a recording, label elapsed-time cuts/speedups. Never splice a reference response
   into a live request and imply that the model produced it.

## Timed scenes

| Time | Screen / action | Narration |
| --- | --- | --- |
| 0:00–0:15 | Promise composer; no secret/config windows | "Your tests pass. A customer retries after a timeout—and gets charged twice." |
| 0:15–0:45 | Consent, real Nemotron interpretation, model ID/usage | "Nemotron on Nebius proposes the meaning. I review the single-purchase scope before execution." |
| 0:45–1:10 | Approve meaning; execute fixture; $50 vs $25 receipts | "The provider committed the payment before the timeout. The vulnerable retry makes a second charge." |
| 1:10–1:30 | Full five-event trace → reduced two-event trace | "Observations and restart noise disappear. This is the replayable counterexample." |
| 1:30–2:00 | Curated repair panel; live source consent; returned proposal/diff | "The model can propose one scoped key correction. It cannot submit shell commands or arbitrary files." |
| 2:00–2:30 | Review checkbox → approve Docker run → verification result | "Execution checks the captured trace, 780 additional schedules, and the exported regression. No-op billing is rejected." |
| 2:30–2:45 | Download JSON bundle; scope/limitations | "The artifact is a runnable regression and bounded evidence, not a production multi-purchase patch." |
| 2:45–2:50 | Product name / repository link supplied by you | "AI proposes. Executed traces establish the result." |

If actual inference exceeds the timing window, shorten narration or label a time cut; do not
fabricate speed. Separate interaction evidence from local Lighthouse scores and test mocks.

## Honest fallback

Use the UI's **Reference proposal · no model call** path if live inference is unavailable.
Keep that badge visible and state that the repair is a reference demonstration. Include
separate successful live runtime evidence before claiming NVIDIA/Nebius integration. A
reference-only packet is not sufficient live proof, and outages should not be hidden.

## Export / submission

Upload the completed public YouTube video yourself; publishing has not been authorized here.
Verify duration, public accessibility without login, legibility, and every source/provenance label.
