import type { PaymentGateway } from "./service.ts";

export function createWorkflow(provider: PaymentGateway) {
  let acknowledged = false;
  return {
    attempt: () => {
      if (acknowledged) return;
      acknowledged = provider.charge("purchase:demo-001") === "acknowledged";
    },
  };
}
