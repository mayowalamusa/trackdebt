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

/** Add days to an ISO date string using calendar arithmetic. Returns yyyy-mm-dd. */
export function addDaysLocalISO(days: number, fromISO?: string): string {
  const base = new Date(`${fromISO ?? todayLocalISO()}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/** Whole days from a -> b (b - a). Both inputs are yyyy-mm-dd strings.
 *  Positive when b is after a. */
export function daysBetween(aISO: string, bISO: string): number {
  const a = new Date(`${aISO}T00:00:00Z`);
  const b = new Date(`${bISO}T00:00:00Z`);
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86400000);
}
