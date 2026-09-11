import { describe, expect, it } from "vitest";
import { isCleanupEligible, restorationState } from "./account-lifecycle.server";

describe("account restoration lifecycle", () => {
  const now = Date.parse("2026-09-11T00:00:00.000Z");

  it("allows a pending account before its server deadline", () => {
    expect(restorationState("deletion_pending", "2026-09-20T00:00:00.000Z", now)).toBe("restorable");
  });

  it("rejects expired and permanently deleted accounts", () => {
    expect(restorationState("deletion_pending", "2026-09-10T00:00:00.000Z", now)).toBe("expired");
    expect(restorationState("deleted", "2026-09-20T00:00:00.000Z", now)).toBe("expired");
  });

  it("does not require restoration for active accounts", () => {
    expect(restorationState("active", null, now)).toBe("active");
  });

  it("only marks expired pending accounts for cleanup", () => {
    const base = { accountStatus: "deletion_pending" as const, deletedAt: "2026-08-01T00:00:00.000Z", deletionExpiresAt: "2026-09-10T00:00:00.000Z" };
    expect(isCleanupEligible(base, now)).toBe(true);
    expect(isCleanupEligible({ ...base, deletionExpiresAt: "2026-09-20T00:00:00.000Z" }, now)).toBe(false);
    expect(isCleanupEligible({ ...base, accountStatus: "active" }, now)).toBe(false);
  });

  it("does not clean another user's eligible record by changing ownership data", () => {
    expect(isCleanupEligible({ accountStatus: "deletion_pending", deletedAt: null, deletionExpiresAt: "2026-09-01T00:00:00.000Z" }, now)).toBe(false);
  });
});