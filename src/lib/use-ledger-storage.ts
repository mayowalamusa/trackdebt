import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { BusinessProfile, Customer, Txn } from "./ledger";
import { emptyProfile } from "./ledger";
import type { ReminderRecord } from "./reminders";
import { defaultNotificationSettings, type InAppNotification, type NotificationSettings } from "./notifications";
import { isPlainObject, readJSON, writeJSON } from "./storage";
import { freeSubscription, normalize, resolvePlan, getEntitlements, type Subscription, type PromoEntitlement } from "./subscription";

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

export function usePromoEntitlements() {
  const [promo, setPromo, loaded] = usePersisted<PromoEntitlement | null>(
    "trackdebt.v3.promo",
    null,
    { validate: (p) => p === null || isPlainObject(p) }
  );
  return [promo, setPromo, loaded] as const;
}

export function useEntitlements() {
  const [sub, , subLoaded] = useSubscription();
  const [promo, , promoLoaded] = usePromoEntitlements();
  const plan = resolvePlan(sub, promo);
  return { entitlements: getEntitlements(plan), loaded: subLoaded && promoLoaded };
}


export function useNotificationSettings() {
  return usePersisted<NotificationSettings>(
    "trackdebt.v3.notification_settings",
    defaultNotificationSettings,
    { validate: isPlainObject }
  );
}

export function useInAppNotifications() {
  return usePersisted<InAppNotification[]>(
    "trackdebt.v3.in_app_notifications",
    [],
    { validate: Array.isArray }
  );
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

/** Receipt numbering lives in its own module; re-exported here so existing
 *  callers keep working. */
export { issueReceiptReference } from "./receipt-counter";
