import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { BusinessProfile, Customer, Txn } from "./ledger";
import { emptyProfile } from "./ledger";
import type { ReminderRecord } from "./reminders";
import { isPlainObject, readJSON, writeJSON } from "./storage";
import { freeSubscription, normalize, type Subscription } from "./subscription";

type PersistOptions<T> = {
  migrate?: (raw: T) => T;
  validate?: (parsed: unknown) => boolean;
  /** Shown once if the stored value could not be read. */
  corruptMessage?: string;
};

function usePersisted<T>(key: string, initial: T, options: PersistOptions<T> = {}) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const warnedQuota = useRef(false);

  useEffect(() => {
    const read = readJSON<T>(key, initial, {
      ...(options.migrate ? { migrate: options.migrate } : {}),
      ...(options.validate ? { validate: options.validate } : {}),
    });
    setValue(read.value);
    if (read.corrupt && options.corruptMessage) {
      toast.error(options.corruptMessage);
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    const res = writeJSON(key, value);
    if (!res.ok && !warnedQuota.current) {
      warnedQuota.current = true;
      toast.error(
        res.reason === "quota"
          ? "This device is out of storage space. Recent changes may not be saved — export a backup."
          : "Changes could not be saved on this device.",
      );
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
  return usePersisted<Customer[]>("debtbook.v2.customers", [], {
    migrate: migrateCustomers,
    validate: Array.isArray,
    corruptMessage:
      "Saved customer data on this device could not be read. A copy was kept so nothing was deleted.",
  });
}

export function usePersistentProfile() {
  return usePersisted<BusinessProfile>("debtbook.v2.profile", emptyProfile, {
    migrate: (p) => ({ ...emptyProfile, ...p }),
    validate: isPlainObject,
    corruptMessage: "Your saved business profile could not be read and was reset on this device.",
  });
}

export function useReminderHistory() {
  return usePersisted<ReminderRecord[]>("trackdebt.v3.reminders", [], {
    validate: Array.isArray,
  });
}

export function useSubscription() {
  const [sub, setSub, loaded] = usePersisted<Subscription>(
    "trackdebt.v3.subscription",
    freeSubscription,
    { migrate: normalize, validate: isPlainObject },
  );
  return [sub, setSub, loaded] as const;
}

export type OnboardingTips = {
  addCustomer: boolean;
  openCustomer: boolean;
  reminder: boolean;
};

export type OnboardingState = {
  completed: boolean;
  tips: OnboardingTips;
};

export const defaultOnboarding: OnboardingState = {
  completed: false,
  tips: { addCustomer: false, openCustomer: false, reminder: false },
};

export function useOnboardingState() {
  return usePersisted<OnboardingState>("trackdebt.v3.onboarding", defaultOnboarding, {
    validate: isPlainObject,
    migrate: (o) => ({
      completed: !!o?.completed,
      tips: {
        addCustomer: !!o?.tips?.addCustomer,
        openCustomer: !!o?.tips?.openCustomer,
        reminder: !!o?.tips?.reminder,
      },
    }),
  });
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
