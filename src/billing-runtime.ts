export type BillingAction = "charge" | "charge_timeout" | "retry" | "restart" | "observe";
export type BillingProvider = {
  readonly charge: (idempotencyKey: string | null) => "acknowledged" | "timed_out";
};
export type BillingWorkflow = { readonly attempt: () => void };
export type WorkflowFactory = (provider: BillingProvider) => BillingWorkflow;
export type BillingTrace = {
  readonly step: number;
  readonly action: BillingAction;
  readonly outcome: "committed" | "deduplicated" | "already_confirmed" | "restarted" | "observed";
  readonly response: "acknowledged" | "timed_out" | "none";
  readonly successfulCharges: number;
  readonly chargedCents: number;
};
export type BillingReplay = {
  readonly property: "at_most_one_charge_per_intent";
  readonly holds: boolean;
  readonly successfulCharges: number;
  readonly chargedCents: number;
  readonly trace: readonly BillingTrace[];
};

export class BillingAdapterError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "BillingAdapterError";
    this.code = code;
  }
}

function assertNever(_value: never): never {
  throw new BillingAdapterError("unsupported_action");
}

export function adaptBillingModule(imported: unknown): WorkflowFactory {
  if (
    typeof imported !== "object" ||
    imported === null ||
    !("createWorkflow" in imported) ||
    typeof imported.createWorkflow !== "function"
  ) {
    throw new BillingAdapterError("adapter_contract_invalid");
  }
  const createWorkflow = imported.createWorkflow;
  return (provider) => {
    const worker: unknown = createWorkflow(provider);
    if (
      typeof worker !== "object" ||
      worker === null ||
      !("attempt" in worker) ||
      typeof worker.attempt !== "function"
    ) {
      throw new BillingAdapterError("adapter_contract_invalid");
    }
    const attempt = worker.attempt;
    return {
      attempt: () => {
        const result: unknown = attempt.call(worker);
        if (result !== undefined) throw new BillingAdapterError("adapter_contract_invalid");
      },
    };
  };
}

export function runBillingSchedule(
  factory: WorkflowFactory,
  actions: readonly BillingAction[],
): BillingReplay {
  const keys = new Set<string>();
  let successfulCharges = 0;
  let requests = 0;
  let insideAttempt = false;
  let timesOut = false;
  let response: BillingTrace["response"] = "none";
  const provider: BillingProvider = {
    charge: (key) => {
      if (!insideAttempt) throw new BillingAdapterError("provider_call_outside_attempt");
      if (key !== null && (typeof key !== "string" || key.length === 0 || key.length > 200)) {
        throw new BillingAdapterError("invalid_idempotency_key");
      }
      requests += 1;
      if (requests > 100) throw new BillingAdapterError("provider_call_budget_exceeded");
      if (key === null || !keys.has(key)) successfulCharges += 1;
      if (key !== null) keys.add(key);
      response = timesOut ? "timed_out" : "acknowledged";
      return response;
    },
  };
  let worker = factory(provider);
  const trace: BillingTrace[] = [];
  for (const action of actions) {
    const previousCharges = successfulCharges;
    const previousRequests = requests;
    let outcome: BillingTrace["outcome"];
    response = "none";
    switch (action) {
      case "charge":
      case "charge_timeout":
      case "retry":
        timesOut = action === "charge_timeout";
        insideAttempt = true;
        try {
          worker.attempt();
        } finally {
          insideAttempt = false;
        }
        outcome =
          requests === previousRequests
            ? "already_confirmed"
            : successfulCharges === previousCharges
              ? "deduplicated"
              : "committed";
        break;
      case "restart":
        worker = factory(provider);
        outcome = "restarted";
        break;
      case "observe":
        outcome = "observed";
        break;
      default:
        return assertNever(action);
    }
    trace.push({
      step: trace.length + 1,
      action,
      outcome,
      response,
      successfulCharges,
      chargedCents: successfulCharges * 2500,
    });
  }
  return {
    property: "at_most_one_charge_per_intent",
    holds: successfulCharges <= 1,
    successfulCharges,
    chargedCents: successfulCharges * 2500,
    trace,
  };
}

export function reduceBillingSchedule(
  factory: WorkflowFactory,
  actions: readonly BillingAction[],
): readonly BillingAction[] {
  if (runBillingSchedule(factory, actions).holds) return actions;
  let reduced = [...actions];
  let index = 0;
  while (index < reduced.length) {
    const candidate = reduced.filter((_, position) => position !== index);
    if (runBillingSchedule(factory, candidate).holds) index += 1;
    else {
      reduced = candidate;
      index = 0;
    }
  }
  return reduced;
}
