import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: "web",
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL("./web/index.html", import.meta.url)),
        primitives: fileURLToPath(new URL("./web/primitives.html", import.meta.url)),
      },
    },
  },
});
