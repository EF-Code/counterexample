import type { BillingAction } from "./billing-runtime.ts";
import { adaptBillingModule, runBillingSchedule } from "./billing-runtime.ts";

const adapter: unknown = await import(new URL("./counterexample.adapter.ts", import.meta.url).href);
const factory = adaptBillingModule(adapter);
const capturedActions: readonly BillingAction[] = [
  "observe",
  "charge_timeout",
  "restart",
  "observe",
  "retry",
];
const captured = runBillingSchedule(factory, capturedActions);
const repeated = runBillingSchedule(factory, capturedActions);
const actions: readonly BillingAction[] = [
  "charge",
  "charge_timeout",
  "retry",
  "restart",
  "observe",
];
let frontier: readonly (readonly BillingAction[])[] = [[]];
let schedulesChecked = 0;
let violationsFound = 0;
let nonExercisedPaymentSchedules = 0;
for (let depth = 1; depth <= 4; depth += 1) {
  frontier = frontier.flatMap((prefix) => actions.map((action) => [...prefix, action]));
  for (const schedule of frontier) {
    const result = runBillingSchedule(factory, schedule);
    schedulesChecked += 1;
    if (!result.holds) violationsFound += 1;
    const hasPayment = schedule.some(
      (action) => action === "charge" || action === "charge_timeout" || action === "retry",
    );
    if (hasPayment && result.successfulCharges === 0) nonExercisedPaymentSchedules += 1;
  }
}
process.stdout.write(
  `${JSON.stringify({
    captured,
    capturedRepeatMatches: JSON.stringify(captured) === JSON.stringify(repeated),
    schedulesChecked,
    violationsFound,
    nonExercisedPaymentSchedules,
  })}\n`,
);
