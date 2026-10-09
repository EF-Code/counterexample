import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { z } from "zod";
import type { AdapterReport, AdapterRequest } from "./adapter-contract.ts";
import { workerReplySchema } from "./adapter-contract.ts";
import { assertNever } from "./domain.ts";

export class RepositoryError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "RepositoryError";
    this.code = code;
  }
}

export async function analyzeAdapter(request: AdapterRequest): Promise<AdapterReport> {
  const adapterPath = resolve(request.adapterPath);
  if (!/\.(?:ts|mts|js|mjs)$/.test(adapterPath))
    throw new RepositoryError("unsupported_adapter_extension");
  try {
    await access(adapterPath);
  } catch (error) {
    if (error instanceof Error) throw new RepositoryError("adapter_unreadable");
    throw error;
  }
  try {
    const output = await executeWorker(
      process.execPath,
      [
        "--max-old-space-size=128",
        fileURLToPath(new URL("./adapter-worker.ts", import.meta.url)),
        JSON.stringify({ ...request, adapterPath }),
      ],
      {
        cwd: dirname(adapterPath),
        env: { NODE_NO_WARNINGS: "1" },
        timeout: 5000,
        killSignal: "SIGKILL",
        maxBuffer: 256 * 1024,
        encoding: "utf8",
        shell: false,
      },
    );
    const body: unknown = JSON.parse(output.stdout);
    const reply = workerReplySchema.parse(body);
    switch (reply.status) {
      case "ok":
        return reply.report;
      case "error":
        throw new RepositoryError(reply.code);
      default:
        return assertNever(reply);
    }
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      throw new RepositoryError("invalid_worker_output");
    if (error instanceof Error) {
      const limited = z.object({ killed: z.literal(true) }).safeParse(error);
      throw new RepositoryError(
        limited.success ? "adapter_execution_limit_exceeded" : "adapter_execution_failed",
      );
    }
    throw error;
  }
}

export const executeWorker = promisify(execFile);
