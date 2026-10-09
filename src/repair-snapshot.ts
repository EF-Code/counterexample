import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { runSandbox } from "./docker-sandbox.ts";
import { regressionSource } from "./regression-export.ts";
import type { RepairRecord } from "./repair-contract.ts";
import { RepairError, verificationSchema } from "./repair-contract.ts";

export type Snapshot = {
  readonly service: string;
  readonly adapter: string;
  readonly runtime: string;
  readonly verifier: string;
};
export const snapshotFiles = [
  ["service.ts", "service"],
  ["counterexample.adapter.ts", "adapter"],
  ["billing-runtime.ts", "runtime"],
  ["verifier.ts", "verifier"],
] as const;

export function sha256(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

export async function readSource(path: string): Promise<string> {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.size > 64 * 1024) throw new RepairError("snapshot_file_invalid");
  return readFile(path, "utf8");
}

export async function readProject(project: string): Promise<Snapshot> {
  return {
    service: await readSource(resolve(project, "service.ts")),
    adapter: await readSource(resolve(project, "counterexample.adapter.ts")),
    runtime: await readFile(new URL("./billing-runtime.ts", import.meta.url), "utf8"),
    verifier: await readFile(new URL("./sandbox-verifier.ts", import.meta.url), "utf8"),
  };
}

export async function reserveOutput(path: string): Promise<string> {
  const output = resolve(path);
  await mkdir(dirname(output), { recursive: true });
  try {
    await mkdir(output, { mode: 0o700 });
  } catch (error) {
    if (error instanceof Error) {
      const exists = z.object({ code: z.literal("EEXIST") }).safeParse(error);
      throw new RepairError(exists.success ? "output_directory_exists" : "output_directory_failed");
    }
    throw error;
  }
  return output;
}

export async function writeSnapshot(directory: string, snapshot: Snapshot): Promise<void> {
  for (const [file, key] of snapshotFiles) {
    await writeFile(join(directory, file), snapshot[key], { flag: "wx", mode: 0o600 });
  }
}

export async function reviewedSnapshot(directory: string, record: RepairRecord): Promise<Snapshot> {
  const runtime = await readFile(new URL("./billing-runtime.ts", import.meta.url), "utf8");
  const verifier = await readFile(new URL("./sandbox-verifier.ts", import.meta.url), "utf8");
  if (sha256(runtime) !== record.hashes.runtime || sha256(verifier) !== record.hashes.verifier) {
    throw new RepairError("verification_tools_mismatch");
  }
  const source: Snapshot = {
    service: await readSource(join(directory, "service.ts")),
    adapter: await readSource(join(directory, "counterexample.adapter.ts")),
    runtime: await readSource(join(directory, "billing-runtime.ts")),
    verifier: await readSource(join(directory, "verifier.ts")),
  };
  for (const [, key] of snapshotFiles) {
    if (sha256(source[key]) !== record.hashes[key]) throw new RepairError("snapshot_hash_mismatch");
  }
  return source;
}

export async function verifySnapshot(snapshot: Snapshot, image?: string) {
  const result = await runStaged(snapshot, "verifier.ts", image);
  const output: unknown = JSON.parse(result.stdout);
  return { verification: verificationSchema.parse(output), imageId: result.imageId };
}

export async function verifyRegression(snapshot: Snapshot, image: string): Promise<void> {
  await runStaged(snapshot, "counterexample.test.ts", image);
}

async function runStaged(
  snapshot: Snapshot,
  entry: "verifier.ts" | "counterexample.test.ts",
  image?: string,
) {
  const root = await mkdtemp(join(tmpdir(), "counterexample-verify-"));
  const workspace = join(root, "work");
  await mkdir(workspace, { mode: 0o755 });
  try {
    for (const [file, key] of snapshotFiles) {
      await writeFile(join(workspace, file), snapshot[key], { mode: 0o644 });
    }
    await writeFile(join(workspace, "package.json"), '{"type":"module"}', { mode: 0o644 });
    await writeFile(join(workspace, "counterexample.runtime.ts"), snapshot.runtime, {
      mode: 0o644,
    });
    await writeFile(
      join(workspace, "counterexample.test.ts"),
      regressionSource("./counterexample.adapter.ts", ["charge_timeout", "retry"]),
      { mode: 0o644 },
    );
    return await runSandbox({ workspace, entry, ...(image === undefined ? {} : { image }) });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
