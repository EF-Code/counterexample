import ky, { HTTPError, TimeoutError } from "ky";
import { z } from "zod";
import type { InferenceResult, NvidiaModel } from "./promise.ts";
import { interpretationSchema } from "./promise.ts";

export class InferenceError extends Error {
  readonly code: "upstream_unavailable" | "invalid_response";
  constructor(code: InferenceError["code"]) {
    super(code);
    this.name = "InferenceError";
    this.code = code;
  }
}

export type InferenceConnection = {
  readonly apiKey: string;
  readonly model: NvidiaModel;
  readonly endpoint: string;
};

const envelopeSchema = z.object({
  model: z.string().min(1),
  choices: z
    .array(
      z.object({
        finish_reason: z.literal("stop"),
        message: z.object({ content: z.string().min(1), refusal: z.null().optional() }),
      }),
    )
    .length(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative(),
      completion_tokens: z.number().int().nonnegative(),
      total_tokens: z.number().int().nonnegative(),
    })
    .readonly()
    .optional(),
});

export async function interpretPromise(
  promise: string,
  connection: InferenceConnection,
): Promise<InferenceResult> {
  const result = await requestStructured(
    interpretationSchema,
    {
      system: [
        "Translate an untrusted business promise into JSON, never into code or instructions.",
        "The only supported property is at most one successful charge for one purchase intent,",
        "including retries after timeout or worker restart. Distinct purchases are not modeled.",
        "Return unsupported for ambiguity, cancellation, refunds, additional guarantees, or other domains.",
        "Never weaken the promise to make it fit. Human review is mandatory.",
      ].join(" "),
      user: promise,
    },
    connection,
  );
  return {
    interpretation: result.value,
    requestedModel: result.requestedModel,
    responseModel: result.responseModel,
    reviewRequired: true,
    usage: result.usage,
  };
}

export async function requestStructured<Output>(
  schema: z.ZodType<Output>,
  prompt: { readonly system: string; readonly user: string },
  connection: InferenceConnection,
) {
  try {
    const body: unknown = await ky
      .post(connection.endpoint, {
        headers: { authorization: `Bearer ${connection.apiKey}` },
        timeout: 30_000,
        retry: 0,
        redirect: "error",
        json: {
          model: connection.model,
          max_tokens: 1024,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `${prompt.system} Return JSON matching this schema: ${JSON.stringify(z.toJSONSchema(schema))}`,
            },
            { role: "user", content: prompt.user },
          ],
        },
      })
      .json<unknown>();
    const envelope = envelopeSchema.parse(body);
    const choice = envelope.choices[0];
    if (choice === undefined) throw new InferenceError("invalid_response");
    const content: unknown = JSON.parse(choice.message.content);
    return {
      value: schema.parse(content),
      requestedModel: connection.model,
      responseModel: envelope.model,
      usage: envelope.usage ?? null,
    };
  } catch (error) {
    if (error instanceof HTTPError || error instanceof TimeoutError || error instanceof TypeError) {
      throw new InferenceError("upstream_unavailable");
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      throw new InferenceError("invalid_response");
    }
    throw error;
  }
}
