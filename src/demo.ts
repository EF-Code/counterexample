import { createEvidence } from "./evidence.ts";

process.stdout.write(`${JSON.stringify(createEvidence(), null, 2)}\n`);
