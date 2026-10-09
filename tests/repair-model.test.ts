import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { replay } from "../src/engine.ts";
import { proposeRepair } from "../src/repair-model.ts";

async function provider(content: unknown) {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        model: "nvidia/nemotron-3-super-120b-a12b",
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) } }],
        usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
      }),
    );
  });
  const endpoint = await new Promise<string>((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address !== null && typeof address !== "string")
        resolve(`http://127.0.0.1:${address.port}/v1/chat/completions`);
    }),
  );
  return {
    endpoint,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

const context = {
  serviceSource: "provider.charge(null)",
  captured: replay({ workflow: "vulnerable", actions: ["charge_timeout", "retry"] }),
};
const connection = {
  apiKey: "test-only-token",
  model: "nvidia/nemotron-3-super-120b-a12b",
} as const;

describe("Nebius restricted repair proposals", () => {
  it("returns typed proposal provenance when the provider chooses an allowed correction", async () => {
    // Given a real local HTTP fixture implementing the Nebius envelope.
    const fixture = await provider({
      status: "proposal",
      operation: "replace_charge_key",
      file: "service.ts",
      replacementKey: "purchase:one",
      rationale: "Use a stable key for the purchase.",
    });
    try {
      // When the model adapter requests a proposal.
      const result = await proposeRepair(context, { ...connection, endpoint: fixture.endpoint });
      // Then only typed patch data and actual envelope metadata are accepted.
      expect(result).toMatchObject({
        value: { status: "proposal", replacementKey: "purchase:one" },
        responseModel: connection.model,
        usage: { total_tokens: 300 },
      });
    } finally {
      await fixture.close();
    }
  });

  it("preserves abstention when the model declines the repair profile", async () => {
    // Given a model abstaining instead of proposing a correction.
    const fixture = await provider({
      status: "abstain",
      reason: "The source does not fit this profile.",
    });
    try {
      // When the response is parsed.
      const result = await proposeRepair(context, { ...connection, endpoint: fixture.endpoint });
      // Then no reference proposal silently replaces it.
      expect(result.value.status).toBe("abstain");
    } finally {
      await fixture.close();
    }
  });

  it("rejects generated commands when model output exceeds the allowed operation", async () => {
    // Given executable content rather than the restricted data schema.
    const fixture = await provider({
      status: "proposal",
      operation: "replace_charge_key",
      file: "service.ts",
      replacementKey: "purchase:one",
      rationale: "Correction",
      command: "execute untrusted code",
    });
    try {
      // When the response crosses the SDK boundary.
      const result = proposeRepair(context, { ...connection, endpoint: fixture.endpoint });
      // Then it is rejected before any application or execution.
      await expect(result).rejects.toMatchObject({ code: "invalid_response" });
    } finally {
      await fixture.close();
    }
  });
});
