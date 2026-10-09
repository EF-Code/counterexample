import { serve } from "@hono/node-server";
import { createApp } from "../src/app.ts";
import { envSchema } from "../src/config.ts";

export default async function setup() {
  const app = createApp(envSchema.parse({ ENABLE_LIVE_AI: "false" }));
  let server: ReturnType<typeof serve> | undefined;
  const port = await new Promise<number>((resolve) => {
    server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 }, (info) =>
      resolve(info.port),
    );
  });
  process.env["CE_E2E_BASE_URL"] = `http://127.0.0.1:${port}`;
  return async () => {
    await new Promise<void>((resolve, reject) => {
      if (server === undefined) return resolve();
      server.close((error) => (error ? reject(error) : resolve()));
    });
  };
}
