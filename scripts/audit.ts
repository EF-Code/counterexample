import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BrowserContext } from "@playwright/test";
import { chromium } from "@playwright/test";
import lighthouse, { desktopConfig } from "lighthouse";
import { z } from "zod";
import setup from "../e2e/setup.ts";

class AuditError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "AuditError";
  }
}

const teardown = await setup();
const profile = await mkdtemp(join(tmpdir(), "counterexample-audit-"));
const executablePath = process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"];
let context: BrowserContext | undefined;
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    ...(executablePath === undefined ? {} : { executablePath }),
    args: ["--remote-debugging-port=0"],
    headless: true,
  });
  const url = process.env["CE_E2E_BASE_URL"];
  if (url === undefined) throw new AuditError("Missing isolated audit server");
  const port = z.coerce
    .number()
    .int()
    .positive()
    .parse((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]);
  await mkdir("artifacts/lighthouse", { recursive: true });
  const summary: {
    readonly mode: string;
    readonly scores: Readonly<Record<string, number | null>>;
  }[] = [];
  for (const mode of ["mobile", "desktop"] as const) {
    for (let run = 1; run <= 3; run += 1) {
      const result = await lighthouse(
        url,
        {
          port,
          output: "json",
          logLevel: "error",
          onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
        },
        mode === "desktop" ? desktopConfig : undefined,
      );
      if (result === undefined) throw new AuditError("Lighthouse returned no report");
      await writeFile(
        `artifacts/lighthouse/${mode}-${run}.json`,
        JSON.stringify(result.lhr, null, 2),
      );
      const scores = Object.fromEntries(
        Object.entries(result.lhr.categories).map(([name, category]) => [
          name,
          category.score === null ? null : Math.round(category.score * 100),
        ]),
      );
      summary.push({ mode, scores });
    }
  }
  await writeFile("artifacts/lighthouse/summary.json", JSON.stringify(summary, null, 2));
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} finally {
  await context?.close();
  await teardown();
  await rm(profile, { recursive: true, force: true });
}
