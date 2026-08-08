import { useEffect, useState } from "react";
import type { BusinessProfile, Customer, Txn } from "./ledger";
import { emptyProfile } from "./ledger";
import type { ReminderRecord } from "./reminders";
import { freeSubscription, normalize, type Subscription } from "./subscription";

function usePersisted<T>(key: string, initial: T, migrate?: (raw: T) => T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        setValue(migrate ? migrate(parsed) : parsed);
      }
    } catch {
      /* ignore corrupt storage */
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota errors */
    }
  }, [key, value, loaded]);

  return [value, setValue, loaded] as const;
}

/** Phase 1 migration: give older transactions the new payment-term shape
 *  without discarding anything the user already recorded. */
const migrateCustomers = (cs: Customer[]): Customer[] =>
  (Array.isArray(cs) ? cs : []).map((c) => ({
    ...c,
    notes: c.notes ?? "",
    txns: (c.txns ?? []).map((t): Txn => (t.term ? t : { ...t })),
  }));

export function usePersistentCustomers() {
  return usePersisted<Customer[]>("debtbook.v2.customers", [], migrateCustomers);
}

export function usePersistentProfile() {
  return usePersisted<BusinessProfile>("debtbook.v2.profile", emptyProfile, (p) => ({
    ...emptyProfile,
    ...p,
  }));
}

export function useReminderHistory() {
  return usePersisted<ReminderRecord[]>("trackdebt.v3.reminders", []);
}

export function useSubscription() {
  const [sub, setSub, loaded] = usePersisted<Subscription>(
    "trackdebt.v3.subscription",
    freeSubscription,
    normalize,
  );
  return [sub, setSub, loaded] as const;
}

const COUNTER_KEY = "trackdebt.v3.receiptCounter";

/** Monotonic receipt counter. Numbers are never reused, even after a
 *  transaction is deleted. Written synchronously so two quick calls can
 *  never collide. */
export function issueReceiptReference(): string {
  const year = new Date().getFullYear();
  let next = 1;
  try {
    const raw = window.localStorage.getItem(COUNTER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { year: number; next: number };
      if (parsed.year === year && Number.isFinite(parsed.next)) next = parsed.next;
    }
    window.localStorage.setItem(COUNTER_KEY, JSON.stringify({ year, next: next + 1 }));
  } catch {
    /* fall back to the computed value */
  }
  return `TD-${year}-${String(next).padStart(6, "0")}`;
}

