import ky, { HTTPError, TimeoutError } from "ky";
import { z } from "zod";
import { evidenceSchema, healthSchema, inferenceSchema } from "./contracts.ts";

const client = ky.create({ retry: 0, timeout: 35_000 });
export const api = {
  health: async () => healthSchema.parse(await client.get("/api/health").json<unknown>()),
  evidence: async () => evidenceSchema.parse(await client.get("/api/demo").json<unknown>()),
  interpret: async (promise: string) =>
    inferenceSchema.parse(
      await client
        .post("/api/interpret", {
          json: { promise, consentToSend: true },
        })
        .json<unknown>(),
    ),
};

const errorLabels: Readonly<Record<string, string>> = {
  repair_disabled:
    "Browser repair is disabled. Enable the sandbox in the server environment and restart.",
  repair_session_invalid:
    "The repair session changed. Reload the page; no candidate was authorized by this request.",
  repair_busy: "Another repair operation is running. Wait before starting a new proposal.",
  repair_limit: "This server run has used its five repair attempts. Check usage before restarting.",
  repair_approval_mismatch:
    "The approval does not match the stored proposal. Start a new proposal and review its diff.",
  sandbox_image_unavailable:
    "Docker or the pinned Node image is unavailable. Check local Docker and node:24-alpine; no host execution fallback is used.",
  model_abstained:
    "The model declined this repair profile. No candidate was created. Review the source or use a labeled reference proposal.",
  repair_operation_failed:
    "The repair operation failed. Start a new proposal after checking the local server.",
  live_ai_disabled:
    "Live inference is disabled. Enable it in the server environment, then restart. You can still try the offline fixture.",
  api_key_missing:
    "The server has no Nebius key configured. Add it locally to .env and restart; never paste it into this page.",
  session_inference_limit:
    "This server process reached its ten-attempt inference limit. Check usage before restarting, or use the offline fixture.",
  invalid_response:
    "The model returned an unusable interpretation. Nothing was approved. Retry or use the offline fixture.",
  upstream_unavailable:
    "Nebius inference is unavailable. Check your account and model access, then retry or use the offline fixture.",
};

export async function errorMessage(error: unknown): Promise<string> {
  if (error instanceof HTTPError) {
    let body: unknown;
    try {
      body = await error.response.json();
    } catch (parseError) {
      if (!(parseError instanceof SyntaxError)) throw parseError;
      body = null;
    }
    const parsed = z.object({ error: z.string() }).safeParse(body);
    if (parsed.success)
      return (
        errorLabels[parsed.data.error] ??
        "The request was rejected. Review the input and try again."
      );
    return "The server could not complete the request. Retry or use the offline fixture.";
  }
  if (error instanceof TimeoutError)
    return "The request timed out. It may still count toward server usage. Retry deliberately.";
  if (error instanceof z.ZodError)
    return "The response did not match the evidence contract. No result was accepted.";
  if (error instanceof Error)
    return "Could not reach the local API. Check that the server is running, then retry.";
  return "An unexpected error occurred. Reload the page to recover.";
}
