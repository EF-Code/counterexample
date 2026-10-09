import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { InferenceError, interpretPromise } from "../src/nebius.ts";

async function withProvider(body: unknown, status = 200) {
  const server = createServer((_request, response) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  });
  const endpoint = await new Promise<string>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address !== null && typeof address !== "string") {
        resolve(`http://127.0.0.1:${address.port}/v1/chat/completions`);
      }
    });
  });
  return {
    endpoint,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

const connection = {
  apiKey: "test-only-token",
  model: "nvidia/nemotron-3-super-120b-a12b",
} as const;

describe("Nebius wire adapter", () => {
  it("returns typed interpretation when the provider returns a supported property", async () => {
    // Given a real HTTP fixture using the Nebius response envelope.
    const provider = await withProvider({
      model: connection.model,
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              status: "supported",
              property: "at_most_one_charge_per_intent",
              scope: "single_purchase_intent",
              explanation: "One charge per purchase, including retries.",
            }),
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    });
    try {
      // When the adapter makes a network request.
      const result = await interpretPromise("Never charge twice for one purchase.", {
        ...connection,
        endpoint: provider.endpoint,
      });
      // Then machine-readable meaning and usage require human review.
      expect(result).toMatchObject({
        reviewRequired: true,
        interpretation: { status: "supported", property: "at_most_one_charge_per_intent" },
        usage: { total_tokens: 150 },
      });
    } finally {
      await provider.close();
    }
  });

  it.each([
    {
      model: connection.model,
      choices: [{ finish_reason: "stop", message: { content: "not JSON" } }],
    },
    { model: connection.model, choices: [{ finish_reason: "length", message: { content: "{}" } }] },
    { model: connection.model, choices: [] },
    {
      model: connection.model,
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              status: "supported",
              property: "at_most_one_charge_per_intent",
              scope: "single_purchase_intent",
              explanation: "One charge per purchase.",
            }),
            refusal: "Request refused",
          },
        },
      ],
    },
    {
      model: connection.model,
      choices: [
        {
          finish_reason: "stop",
          message: { content: '{"status":"supported","property":"invented"}' },
        },
      ],
    },
  ])("rejects invalid output when the provider returns an unusable envelope", async (body) => {
    // Given malformed, truncated, empty, or unsupported machine output.
    const provider = await withProvider(body);
    try {
      // When an interpretation is requested.
      const result = interpretPromise("Never charge twice for one purchase.", {
        ...connection,
        endpoint: provider.endpoint,
      });
      // Then no fabricated fallback interpretation is substituted.
      await expect(result).rejects.toMatchObject({ code: "invalid_response" });
    } finally {
      await provider.close();
    }
  });

  it("returns a safe error when the provider denies access", async () => {
    // Given an upstream response whose body must not leak to users.
    const provider = await withProvider({ detail: "sensitive upstream detail" }, 401);
    try {
      // When inference is attempted.
      const result = interpretPromise("Never charge twice for one purchase.", {
        ...connection,
        endpoint: provider.endpoint,
      });
      // Then the caller receives only the typed error category.
      await expect(result).rejects.toEqual(new InferenceError("upstream_unavailable"));
    } finally {
      await provider.close();
    }
  });
});
