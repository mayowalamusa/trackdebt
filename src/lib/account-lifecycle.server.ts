export type AccountStatus = "active" | "deletion_pending" | "deleted";

export function restorationState(status: AccountStatus, deadline: string | null, now = Date.now()): "active" | "restorable" | "expired" {
  if (status === "active") return "active";
  if (status === "deleted" || !deadline) return "expired";
  const expiresAt = Date.parse(deadline);
  return Number.isFinite(expiresAt) && expiresAt > now ? "restorable" : "expired";
}

export function isCleanupEligible(input: { accountStatus: AccountStatus; deletedAt: string | null; deletionExpiresAt: string | null }, now = Date.now()): boolean {
  if (input.accountStatus !== "deletion_pending" || !input.deletedAt || !input.deletionExpiresAt) return false;
  const expiresAt = Date.parse(input.deletionExpiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= now;
}