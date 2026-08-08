// src/lib/backup.ts
import { todayLocalISO } from "./dates";

export type BackupV1 = {
  backupVersion: 1;
  createdAt: string; // ISO timestamp
  payload: {
    profile: unknown;
    customers: unknown;
    reminders: unknown;
    subscription: unknown;
    onboarding: unknown;
    receiptCounter: unknown;
    // keep a place for future keys
    [k: string]: unknown;
  };
};

const KEYS = {
  profile: "debtbook.v2.profile",
  customers: "debtbook.v2.customers",
  reminders: "trackdebt.v3.reminders",
  subscription: "trackdebt.v3.subscription",
  onboarding: "trackdebt.v3.onboarding",
  receiptCounter: "trackdebt.v3.receiptCounter",
};

export function createBackup(): BackupV1 {
  const payload: BackupV1["payload"] = {
    profile: safeGet(KEYS.profile),
    customers: safeGet(KEYS.customers),
    reminders: safeGet(KEYS.reminders),
    subscription: safeGet(KEYS.subscription),
    onboarding: safeGet(KEYS.onboarding),
    receiptCounter: safeGet(KEYS.receiptCounter),
  };

  return {
    backupVersion: 1,
    createdAt: new Date().toISOString(),
    payload,
  };
}

export function formatBackupFilename(createdAt: string) {
  // createdAt in ISO; use yyyy-mm-dd
  const d = createdAt.slice(0, 10);
  return `TrackDebt-Backup-${d}.json`;
}

function safeGet(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function validateBackup(obj: unknown): { ok: true; backup: BackupV1 } | { ok: false; error: string } {
  if (!obj || typeof obj !== "object") return { ok: false, error: "Not a valid JSON object" };
  const b = obj as BackupV1;
  if (b.backupVersion !== 1) return { ok: false, error: "Unsupported backup version" };
  if (!b.payload || typeof b.payload !== "object") return { ok: false, error: "Missing payload" };
  // basic checks for the keys we expect
  const p = b.payload as Record<string, unknown>;
  if (!("customers" in p) || !("profile" in p)) return { ok: false, error: "Missing required data" };
  return { ok: true, backup: b };
}

export async function exportBackupFile(backup: BackupV1) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = formatBackupFilename(backup.createdAt);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function restoreBackup(backup: BackupV1): { ok: true } | { ok: false; error: string } {
  try {
    const p = backup.payload;
    if (p.profile !== undefined) window.localStorage.setItem(KEYS.profile, JSON.stringify(p.profile));
    if (p.customers !== undefined) window.localStorage.setItem(KEYS.customers, JSON.stringify(p.customers));
    if (p.reminders !== undefined) window.localStorage.setItem(KEYS.reminders, JSON.stringify(p.reminders));
    if (p.subscription !== undefined)
      window.localStorage.setItem(KEYS.subscription, JSON.stringify(p.subscription));
    if (p.onboarding !== undefined) window.localStorage.setItem(KEYS.onboarding, JSON.stringify(p.onboarding));
    if (p.receiptCounter !== undefined)
      window.localStorage.setItem(KEYS.receiptCounter, JSON.stringify(p.receiptCounter));

    // leave migration to existing startup logic; reload required to refresh hooks
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "Could not restore backup. The file may be corrupted." };
  }
}
