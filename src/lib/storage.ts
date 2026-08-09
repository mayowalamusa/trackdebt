/**
 * Safe localStorage seam for Track Debt.
 *
 * Every persisted value in the app goes through here so that a corrupt,
 * truncated or unexpectedly-shaped entry can never crash the app and can
 * never be silently thrown away: unreadable data is *quarantined* under a
 * `<key>.corrupt` entry so it can still be recovered by hand, and the app
 * carries on with a safe default.
 */

export type WriteResult =
  | { ok: true }
  | { ok: false; reason: "quota" | "unavailable" | "serialize" };

export const storageAvailable = () => {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
};

/** Copy an unreadable value aside instead of deleting it. */
export function quarantine(key: string, raw: string) {
  try {
    window.localStorage.setItem(`${key}.corrupt`, raw);
  } catch {
    /* nothing more we can do; the original entry is left untouched */
  }
}

export type ReadResult<T> = { value: T; corrupt: boolean };

/**
 * Read + parse a JSON entry.
 * `validate` guards against structurally wrong data (e.g. an object where
 * an array is expected) that would otherwise crash a downstream `.map`.
 */
export function readJSON<T>(
  key: string,
  fallback: T,
  options: { migrate?: (raw: T) => T; validate?: (parsed: unknown) => boolean } = {},
): ReadResult<T> {
  if (!storageAvailable()) return { value: fallback, corrupt: false };
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return { value: fallback, corrupt: false };
  }
  if (raw === null || raw === "") return { value: fallback, corrupt: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    quarantine(key, raw);
    return { value: fallback, corrupt: true };
  }
  if (options.validate && !options.validate(parsed)) {
    quarantine(key, raw);
    return { value: fallback, corrupt: true };
  }
  try {
    const value = options.migrate ? options.migrate(parsed as T) : (parsed as T);
    return { value, corrupt: false };
  } catch {
    quarantine(key, raw);
    return { value: fallback, corrupt: true };
  }
}

export function writeJSON(key: string, value: unknown): WriteResult {
  if (!storageAvailable()) return { ok: false, reason: "unavailable" };
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { ok: false, reason: "serialize" };
  }
  try {
    window.localStorage.setItem(key, serialized);
    return { ok: true };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const quota =
      name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || name === "";
    return { ok: false, reason: quota ? "quota" : "unavailable" };
  }
}

export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
