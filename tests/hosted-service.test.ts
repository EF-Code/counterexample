import { describe, expect, it } from "vitest";
import handler from "../api/index.ts";
import { createHostedApp } from "../src/hosted-app.ts";
import { parseHostedConfig } from "../src/hosted-config.ts";

const origin = "https://counterexample.example";
const password = "test-only-password-with-32-characters";
const hosted = parseHostedConfig({
  APP_PUBLIC_ORIGINS: origin,
  HOSTED_USERNAME: "judge",
  HOSTED_PASSWORD: password,
});
const authorization = `Basic ${Buffer.from(`judge:${password}`).toString("base64")}`;

describe("hosted service", () => {
  it("challenges unauthenticated API requests when access protection is enabled", async () => {
    // Given protected demo access.
    const app = createHostedApp(hosted);
    // When an anonymous visitor requests evidence.
    const response = await app.request(`${origin}/api/demo`);
    // Then the browser receives an authentication challenge and no evidence.
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Basic");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns evidence after valid demo authentication", async () => {
    // Given protected access and a valid judge credential.
    const app = createHostedApp(hosted);
    // When an authenticated browser requests evidence.
    const response = await app.request(`${origin}/api/demo`, { headers: { authorization } });
    // Then real fixture evidence is returned without cacheable credentials.
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ provenance: "deterministic_fixture" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("denies wrong passwords instead of granting a shared repair capability", async () => {
    // Given protected hosted access.
    const app = createHostedApp(hosted);
    // When a visitor requests a session with invalid credentials.
    const response = await app.request(`${origin}/api/repair/session`, {
      headers: { authorization: `Basic ${Buffer.from("judge:wrong").toString("base64")}` },
    });
    // Then the session is not disclosed.
    expect(response.status).toBe(401);
  });

  it("discloses disabled repair rather than pretending to run Docker on Vercel", async () => {
    // Given authenticated hosted access.
    const app = createHostedApp(hosted);
    // When the browser discovers repair availability.
    const response = await app.request(`${origin}/api/repair/session`, {
      headers: { authorization },
    });
    // Then repair is unavailable and no capability token is issued.
    expect(await response.json()).toMatchObject({ enabled: false, token: null });
  });

  it("redirects authenticated browser login to the frontend", async () => {
    // Given a login URL in the API authentication scope.
    const app = createHostedApp(hosted);
    // When the browser authenticates through a navigation.
    const response = await app.request(`${origin}/api/access`, { headers: { authorization } });
    // Then the static frontend is the next destination.
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
  });

  it("rejects cross-origin requests before prompting for credentials", async () => {
    // Given a protected trusted deployment.
    const app = createHostedApp(hosted);
    // When a foreign origin tries to request evidence.
    const response = await app.request(`${origin}/api/demo`, {
      headers: { origin: "https://attacker.example" },
    });
    // Then origin policy fails before authentication.
    expect(response.status).toBe(403);
  });

  it("uses a web-standard fetch entrypoint rather than starting a listener", () => {
    // Given the deployable Vercel function module.
    const entry = handler;
    // When its web-standard interface is inspected, then a request handler is available.
    expect(typeof entry.fetch).toBe("function");
  });
});
