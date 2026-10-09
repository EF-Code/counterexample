import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { runSandbox, SandboxError } from "../src/docker-sandbox.ts";

describe.runIf(process.env["COUNTEREXAMPLE_TEST_DOCKER"] === "true")(
  "hardened Docker execution",
  () => {
    it("removes its own container when an execution deadline is exceeded", async () => {
      // Given a staged, deliberately stuck script and a bounded container runner.
      const root = await mkdtemp(join(tmpdir(), "counterexample-docker-timeout-"));
      const workspace = join(root, "work");
      await mkdir(workspace, { mode: 0o755 });
      await writeFile(join(workspace, "probe.mjs"), "while (true) {}", { mode: 0o644 });
      try {
        // When the execution reaches its deadline.
        let failure: SandboxError | null = null;
        try {
          await runSandbox({ workspace, entry: "probe.mjs" });
        } catch (error) {
          if (error instanceof SandboxError) failure = error;
          else throw error;
        }
        // Then the failed run is reported and its exact container no longer exists.
        expect(failure?.code).toBe("sandbox_execution_failed");
        const name = failure?.containerName;
        if (!name) throw new Error("Failed sandbox did not expose its own container identity");
        const inspected = promisify(execFile)("docker", ["container", "inspect", name], {
          timeout: 5000,
        });
        await expect(inspected).rejects.toMatchObject({ code: 1 });
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }, 30000);
    it("isolates source and credentials when staged code runs", async () => {
      // Given a staged script, an unmounted host canary, and a dummy parent credential.
      const root = await mkdtemp(join(tmpdir(), "counterexample-docker-"));
      const workspace = join(root, "work");
      await mkdir(workspace, { mode: 0o755 });
      const canary = join(root, "private.txt");
      await writeFile(canary, "test-only-private-canary");
      await writeFile(
        join(workspace, "probe.mjs"),
        `
      import {existsSync,writeFileSync,readFileSync} from "node:fs";
      let writeCode = null;
      try { writeFileSync("/work/blocked.txt", "blocked"); } catch(error) { writeCode=error.code; }
      console.log(JSON.stringify({
        uid:process.getuid(),
        credential:process.env.NEBIUS_API_KEY ?? null,
        hostCanaryVisible:existsSync(${JSON.stringify(canary)}),
        dockerSocketVisible:existsSync("/var/run/docker.sock"),
        writeCode,
        routes:readFileSync("/proc/net/route","utf8").trim().split("\\n").length,
      }));
    `,
      );
      await chmod(join(workspace, "probe.mjs"), 0o644);
      vi.stubEnv("NEBIUS_API_KEY", "test-only-parent-sentinel");
      try {
        // When the actual hardened container runs the staged script.
        const result = await runSandbox({ workspace, entry: "probe.mjs" });
        const body: unknown = JSON.parse(result.stdout);
        // Then it has no parent credential, host file, Docker socket, network route, or writable source.
        expect(body).toMatchObject({
          uid: 65534,
          credential: null,
          hostCanaryVisible: false,
          dockerSocketVisible: false,
          writeCode: "EROFS",
          routes: 1,
        });
        expect(result.imageId).toMatch(/^sha256:[a-f0-9]{64}$/);
      } finally {
        vi.unstubAllEnvs();
        await rm(root, { recursive: true, force: true });
      }
    }, 30000);
  },
);
