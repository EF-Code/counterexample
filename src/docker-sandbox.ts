import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { realpath } from "node:fs/promises";
import { promisify } from "node:util";
import { z } from "zod";
import { assertNever } from "./domain.ts";

export class SandboxError extends Error {
  readonly code: string;
  readonly containerName: string | null;
  constructor(code: string, containerName: string | null = null) {
    super(code);
    this.name = "SandboxError";
    this.code = code;
    this.containerName = containerName;
  }
}

export type SandboxRequest = {
  readonly workspace: string;
  readonly entry: "verifier.ts" | "probe.mjs" | "counterexample.test.ts";
  readonly image?: string;
};
export type SandboxResult = { readonly stdout: string; readonly imageId: string };

const execute = promisify(execFile);
const imageIdSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export async function runSandbox(request: SandboxRequest): Promise<SandboxResult> {
  const image = request.image ?? "node:24-alpine";
  if (image !== "node:24-alpine" && !imageIdSchema.safeParse(image).success) {
    throw new SandboxError("sandbox_image_invalid");
  }
  let imageId: string;
  try {
    const inspected = await execute("docker", ["image", "inspect", "--format", "{{.Id}}", image], {
      timeout: 5000,
      maxBuffer: 32 * 1024,
      encoding: "utf8",
      shell: false,
    });
    imageId = imageIdSchema.parse(inspected.stdout.trim());
  } catch (error) {
    if (error instanceof Error) throw new SandboxError("sandbox_image_unavailable");
    throw error;
  }
  const workspace = await realpath(request.workspace);
  if (workspace.includes(",")) throw new SandboxError("sandbox_workspace_invalid");
  const name = `counterexample-${randomUUID()}`;
  let nodeArgs: readonly string[];
  switch (request.entry) {
    case "counterexample.test.ts":
      nodeArgs = ["--test", "/work/counterexample.test.ts"];
      break;
    case "verifier.ts":
    case "probe.mjs":
      nodeArgs = [`/work/${request.entry}`];
      break;
    default:
      return assertNever(request.entry);
  }
  const args = [
    "run",
    "--rm",
    "--pull=never",
    "--name",
    name,
    "--label",
    "counterexample.sandbox=true",
    "--network",
    "none",
    "--read-only",
    "--user",
    "65534:65534",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--memory",
    "256m",
    "--memory-swap",
    "256m",
    "--cpus",
    "1",
    "--pids-limit",
    "64",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=64m",
    "--mount",
    `type=bind,source=${workspace},target=/work,readonly`,
    "--workdir",
    "/work",
    "--entrypoint",
    "node",
    imageId,
    "--max-old-space-size=128",
    ...nodeArgs,
  ];
  try {
    const output = await execute("docker", args, {
      timeout: 15000,
      killSignal: "SIGKILL",
      maxBuffer: 256 * 1024,
      encoding: "utf8",
      shell: false,
    });
    return { stdout: output.stdout, imageId };
  } catch (error) {
    try {
      await execute("docker", ["rm", "-f", name], {
        timeout: 5000,
        encoding: "utf8",
        maxBuffer: 32 * 1024,
        shell: false,
      });
    } catch (cleanupError) {
      const gone = z
        .object({ stderr: z.string().includes("No such container") })
        .safeParse(cleanupError);
      if (!gone.success) throw new SandboxError("sandbox_cleanup_failed", name);
    }
    if (error instanceof Error) throw new SandboxError("sandbox_execution_failed", name);
    throw error;
  }
}
