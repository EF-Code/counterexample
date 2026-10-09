import { describe, expect, it } from "vitest";
import { RepairJobStore } from "../src/repair-job-store.ts";

describe("curated repair admission limits", () => {
  it("rejects concurrent proposals when one operation is active", () => {
    // Given an active proposal lease.
    const store = new RepairJobStore();
    store.startProposal();
    // When a second proposal is requested.
    const start = () => store.startProposal();
    // Then no second operation is admitted.
    expect(start).toThrow("repair_busy");
  });

  it("bounds attempts when failed or completed proposals release their lease", () => {
    // Given five consumed proposal attempts.
    const store = new RepairJobStore();
    for (let index = 0; index < 5; index += 1) {
      store.startProposal();
      store.release();
    }
    // When a sixth attempt is requested.
    const start = () => store.startProposal();
    // Then process-local quota is enforced.
    expect(start).toThrow("repair_limit");
  });

  it("refuses new work when the service is stopping", () => {
    // Given a stopped store.
    const store = new RepairJobStore();
    store.stop();
    // When another proposal is requested.
    const start = () => store.startProposal();
    // Then shutdown cannot create new execution workspaces.
    expect(start).toThrow("repair_closed");
  });
});
