import { z } from "zod";
import { createHostedApp } from "../src/hosted-app.ts";
import { parseHostedConfig } from "../src/hosted-config.ts";
import { logger } from "../src/logger.ts";

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      return await createHostedApp(parseHostedConfig(process.env)).fetch(request);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      logger.error(
        { event: "hosted.request_failed", errorType: error.name },
        "hosted request failed",
      );
      return Response.json(
        { error: error instanceof z.ZodError ? "hosted_configuration_invalid" : "internal_error" },
        {
          status: 503,
          headers: { "cache-control": "no-store" },
        },
      );
    }
  },
};
