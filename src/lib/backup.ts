/**
 * Backup & restore for Track Debt's local data.
 *
 * Everything Track Debt stores lives in a handful of localStorage keys.
 * A backup is just a versioned snapshot of those keys as one JSON file,
 * so the user can move data between devices or recover from a lost app.
 *
 * The format is versioned (BACKUP_VERSION) so a future release can add a
 * migration step in `migrateBackup` without breaking older backup files.
 */

export const BACKUP_VERSION = 1;

const KEYS = {
  customers: "debtbook.v2.customers",
  profile: "debtbook.v2.profile",
  reminders: "trackdebt.v3.reminders",
  subscription: "trackdebt.v3.subscription",
  onboarding: "trackdebt.v3.onboarding",
  receiptCounter: "trackdebt.v3.receiptCounter",
} as const;

export type BackupData = {
  customers: unknown;
  profile: unknown;
  reminders: unknown;
  subscription: unknown;
  onboarding: unknown;
  receiptCounter: unknown;
};

export type BackupFile = {
  version: number;
  app: "track-debt";
  exportedAt: string;
  data: BackupData;
};

const LAST_BACKUP_KEY = "trackdebt.v3.lastBackupAt";

export function getLastBackupAt(): string | null {
  try {
    return window.localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

function setLastBackupAt(iso: string) {
  try {
    window.localStorage.setItem(LAST_BACKUP_KEY, iso);
  } catch {
    /* non-fatal: last-backup label just won't update */
  }
}

function readKey(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeKey(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

/** Snapshot everything Track Debt has stored on this device. */
export function createBackup(): BackupFile {
  const exportedAt = new Date().toISOString();
  const backup: BackupFile = {
    version: BACKUP_VERSION,
    app: "track-debt",
    exportedAt,
    data: {
      customers: readKey(KEYS.customers) ?? [],
      profile: readKey(KEYS.profile) ?? {},
      reminders: readKey(KEYS.reminders) ?? [],
      subscription: readKey(KEYS.subscription),
      onboarding: readKey(KEYS.onboarding),
      receiptCounter: readKey(KEYS.receiptCounter),
    },
  };
  setLastBackupAt(exportedAt);
  return backup;
}

export function backupFilename(b: Pick<BackupFile, "exportedAt">): string {
  const d = new Date(b.exportedAt);
  if (Number.isNaN(d.getTime())) return "track-debt-backup.json";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `track-debt-backup-${y}-${m}-${day}.json`;
}

/** Structural validation only — enough to know it's a Track Debt backup
 *  we can safely act on, not full schema validation of every record. */
export function isValidBackup(input: unknown): input is BackupFile {
  if (!input || typeof input !== "object") return false;
  const b = input as Record<string, unknown>;
  if (b["app"] !== "track-debt") return false;
  if (typeof b["version"] !== "number" || !Number.isFinite(b["version"]) || b["version"] < 1) {
    return false;
  }
  if (typeof b["exportedAt"] !== "string" || Number.isNaN(new Date(b["exportedAt"]).getTime())) {
    return false;
  }
  if (!b["data"] || typeof b["data"] !== "object") return false;
  const d = b["data"] as Record<string, unknown>;
  if (!Array.isArray(d["customers"])) return false;
  if (!d["profile"] || typeof d["profile"] !== "object") return false;
  return true;
}

/** No-op today — the seam future backup-version upgrades hook into. */
export function migrateBackup(input: BackupFile): BackupFile {
  if (input.version === BACKUP_VERSION) return input;
  return { ...input, version: BACKUP_VERSION };
}

export function parseBackupFile(raw: string): BackupFile | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValidBackup(parsed)) return null;
    return migrateBackup(parsed);
  } catch {
    return null;
  }
}

/** Replaces all local Track Debt data with what's in the backup.
 *  Callers should reload the app afterward so every hook re-hydrates
 *  from the newly-written storage instead of holding stale in-memory
 *  state. The write is all-or-nothing: if any key fails (e.g. storage
 *  quota), the previous values are rolled back and the error rethrown, so
 *  the user is never left with half-restored data. */
export function restoreBackup(input: BackupFile): void {
  const b = migrateBackup(input);
  const keys = Object.values(KEYS);
  const snapshot = new Map<string, string | null>();
  for (const k of keys) snapshot.set(k, window.localStorage.getItem(k));

  try {
    writeKey(KEYS.customers, b.data.customers ?? []);
    writeKey(KEYS.profile, b.data.profile ?? {});
    writeKey(KEYS.reminders, b.data.reminders ?? []);
    if (b.data.subscription != null) writeKey(KEYS.subscription, b.data.subscription);
    if (b.data.onboarding != null) writeKey(KEYS.onboarding, b.data.onboarding);
    if (b.data.receiptCounter != null) writeKey(KEYS.receiptCounter, b.data.receiptCounter);
  } catch (err) {
    for (const [k, v] of snapshot) {
      try {
        if (v === null) window.localStorage.removeItem(k);
        else window.localStorage.setItem(k, v);
      } catch {
        /* best effort rollback */
      }
    }
    throw err;
  }
}
