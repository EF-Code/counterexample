export type PaymentGateway = {
  readonly charge: (key: string | null) => "acknowledged" | "timed_out";
};

export function createBillingService(provider: PaymentGateway) {
  let acknowledged = false;
  return {
    attempt: () => {
      if (acknowledged) return;
      acknowledged = provider.charge(null) === "acknowledged";
    },
  };
}
