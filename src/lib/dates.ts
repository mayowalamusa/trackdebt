// src/lib/dates.ts
export function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Return local date in yyyy-mm-dd using the device local timezone. */
export function todayLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse an ISO yyyy-mm-dd into a Date at local midnight. */
export function parseLocalDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/** Add days to a local ISO date string. Returns yyyy-mm-dd. */
export function addDaysLocalISO(days: number, fromISO?: string): string {
  const base = fromISO ? parseLocalDate(fromISO) : parseLocalDate(todayLocalISO());
  base.setDate(base.getDate() + days);
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
}

/** Whole days from a -> b (b - a). Both inputs are yyyy-mm-dd strings.
 *  Positive when b is after a. */
export function daysBetween(aISO: string, bISO: string): number {
  const a = parseLocalDate(aISO);
  const b = parseLocalDate(bISO);
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86400000);
}
