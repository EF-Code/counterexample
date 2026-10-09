import { parseArgs } from "node:util";
import { z } from "zod";
import { SandboxError } from "../src/docker-sandbox.ts";
import { RepairError } from "../src/repair-contract.ts";
import { createSubmissionPacket, PacketError } from "../src/submission-packet.ts";

try {
  const { values } = parseArgs({
    strict: true,
    allowPositionals: false,
    options: {
      output: { type: "string" },
      sandbox: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    process.stdout.write(
      "submission:evidence --output NEW_DIRECTORY [--sandbox]\nFixture-only packet; no model calls or publication. --sandbox rehearses the known reference repair in Docker.\n",
    );
  } else {
    const outputDirectory = z.string().min(1).parse(values.output);
    const manifest = await createSubmissionPacket({ outputDirectory, sandbox: values.sandbox });
    process.stdout.write(`${JSON.stringify({ outputDirectory, manifest }, null, 2)}\n`);
  }
} catch (error) {
  if (error instanceof PacketError || error instanceof RepairError || error instanceof SandboxError)
    process.stderr.write(`${error.code}\n`);
  else if (error instanceof z.ZodError || error instanceof TypeError)
    process.stderr.write("invalid_arguments\n");
  else if (error instanceof Error) process.stderr.write("packet_generation_failed\n");
  else process.stderr.write("packet_generation_failed\n");
  process.exitCode = 2;
}
