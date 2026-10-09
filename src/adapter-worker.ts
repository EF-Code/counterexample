import { pathToFileURL } from "node:url";
import { z } from "zod";
import { adapterRequestSchema, workerErrorSchema } from "./adapter-contract.ts";
import {
  adaptBillingModule,
  BillingAdapterError,
  reduceBillingSchedule,
  runBillingSchedule,
} from "./billing-runtime.ts";

function emit(reply: unknown): void {
  process.stdout.write(`${JSON.stringify(reply)}\n`, () => process.exit(0));
}

try {
  const input: unknown = JSON.parse(process.argv[2] ?? "null");
  const request = adapterRequestSchema.parse(input);
  const imported: unknown = await import(pathToFileURL(request.adapterPath).href);
  const factory = adaptBillingModule(imported);
  const originalReplay = runBillingSchedule(factory, request.actions);
  const reducedActions = reduceBillingSchedule(factory, request.actions);
  emit({
    status: "ok",
    report: {
      execution: "trusted_local_code",
      property: originalReplay.property,
      originalActions: request.actions,
      reducedActions,
      originalReplay,
      reducedReplay: runBillingSchedule(factory, reducedActions),
    },
  });
} catch (error) {
  if (error instanceof z.ZodError) emit({ status: "error", code: "adapter_contract_invalid" });
  else if (error instanceof BillingAdapterError) {
    const code = workerErrorSchema.safeParse(error.code);
    emit({ status: "error", code: code.success ? code.data : "adapter_failed" });
  } else if (error instanceof Error) emit({ status: "error", code: "adapter_failed" });
  else emit({ status: "error", code: "adapter_failed" });
}
