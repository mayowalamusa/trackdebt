/**
 * Monotonic receipt counter (TD-<year>-<000001>).
 *
 * Numbers are never reused — the counter is independent of the ledger, so
 * deleting a transaction never frees its reference. Hardening applied here:
 *
 *  - read-modify-write with a unique token, then a *verify read*: if another
 *    tab wrote between our read and our write, the token won't match and we
 *    retry with the freshly-observed value;
 *  - an in-memory high-water mark, so two calls in the same tick (or a failed
 *    write) can never hand out the same number inside this tab;
 *  - a year rollover resets the sequence to 1 for the new year only.
 *
 * Limitation: localStorage has no atomic compare-and-swap. Two tabs writing
 * in the exact same event-loop turn can still interleave; the verify-and-retry
 * loop makes that window very small but does not eliminate it. A real lock
 * would require a shared backend or the Web Locks API with async callers.
 */

export const COUNTER_KEY = "trackdebt.v3.receiptCounter";

export type CounterState = { year: number; next: number; token?: string };

const MAX_ATTEMPTS = 5;

/** In-tab high-water mark: [year, lastIssuedNumber]. */
let highWater: { year: number; last: number } | null = null;

export const formatReference = (year: number, n: number) =>
  `TD-${year}-${String(n).padStart(6, "0")}`;

export function parseCounter(raw: string | null, year: number): number {
  if (!raw) return 1;
  try {
    const parsed = JSON.parse(raw) as Partial<CounterState>;
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.year === year &&
      typeof parsed.next === "number" &&
      Number.isFinite(parsed.next) &&
      parsed.next >= 1
    ) {
      return Math.floor(parsed.next);
    }
  } catch {
    /* corrupt counter — fall through to a safe restart for this year */
  }
  return 1;
}

/** Test seam: forget the in-memory high-water mark. */
export function __resetReceiptCounterMemory() {
  highWater = null;
}

export function issueReceiptReference(now: Date = new Date()): string {
  const year = now.getFullYear();
  let candidate = highWater && highWater.year === year ? highWater.last + 1 : 1;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let stored = 1;
    try {
      stored = parseCounter(window.localStorage.getItem(COUNTER_KEY), year);
    } catch {
      break; // storage unavailable — fall back to the in-memory sequence
    }
    candidate = Math.max(candidate, stored);
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      window.localStorage.setItem(
        COUNTER_KEY,
        JSON.stringify({ year, next: candidate + 1, token } satisfies CounterState),
      );
      const verify = JSON.parse(
        window.localStorage.getItem(COUNTER_KEY) ?? "{}",
      ) as Partial<CounterState>;
      if (verify.token === token && verify.next === candidate + 1) break;
      // Another tab won the race — retry from its value.
      candidate = candidate + 1;
    } catch {
      break;
    }
  }

  highWater = { year, last: candidate };
  return formatReference(year, candidate);
}
