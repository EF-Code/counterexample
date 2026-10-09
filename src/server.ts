import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { envSchema } from "./config.ts";
import { logger } from "./logger.ts";
import { createRepairService } from "./repair-web-service.ts";

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  process.stderr.write("Invalid configuration. Check PORT, NEBIUS_MODEL, and ENABLE_LIVE_AI.\n");
  process.exit(1);
}
const config = parsed.data;
const repairs = createRepairService(config);
const server = serve(
  {
    fetch: createApp(config, repairs).fetch,
    hostname: "127.0.0.1",
    port: config.PORT,
  },
  (info) => {
    logger.info({ port: info.port, host: "127.0.0.1" }, "server started");
  },
);
server.once("close", () => {
  void repairs.close().catch((error: unknown) => {
    if (error instanceof Error)
      logger.error(
        { event: "repair.shutdown_failed", errorType: error.name },
        "repair shutdown failed",
      );
    else throw error;
  });
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close();
  });
}
