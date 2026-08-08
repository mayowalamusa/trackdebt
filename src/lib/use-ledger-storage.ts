import { useCallback, useEffect, useState } from "react";
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

/** Monotonic receipt counter. Numbers are never reused, even after a
 *  transaction is deleted. */
export function useReceiptCounter() {
  const [counter, setCounter, loaded] = usePersisted<{ year: number; next: number }>(
    "trackdebt.v3.receiptCounter",
    { year: new Date().getFullYear(), next: 1 },
  );

  const issueReference = useCallback(() => {
    const year = new Date().getFullYear();
    let n = 1;
    setCounter((c) => {
      const base = c.year === year ? c.next : 1;
      n = base;
      return { year, next: base + 1 };
    });
    return `TD-${year}-${String(n).padStart(6, "0")}`;
  }, [setCounter]);

  return { counter, issueReference, loaded };
}
