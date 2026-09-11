import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { BusinessProfile, Customer, Txn } from "./ledger";
import { emptyProfile } from "./ledger";
import type { ReminderRecord } from "./reminders";
import { defaultNotificationSettings, type InAppNotification, type NotificationSettings } from "./notifications";
import { isPlainObject, readJSON, writeJSON } from "./storage";
import { freeSubscription, normalize, resolvePlan, getEntitlements, type Subscription, type PromoEntitlement } from "./subscription";
import { freeEntitlement, fetchServerEntitlement, type ServerEntitlement } from "./subscription-api";
import { supabase } from "./supabase";
import { loadCloudSnapshot, syncCloudCustomers, syncCloudNotifications, syncCloudOnboarding, syncCloudPreferences, syncCloudProfile, syncCloudReminders } from "./cloud-data";

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

function useCloudBacked<T>(
  local: readonly [T, React.Dispatch<React.SetStateAction<T>>, boolean],
  select: (snapshot: Awaited<ReturnType<typeof loadCloudSnapshot>>) => T,
  sync: (value: T) => Promise<void>,
) {
  const [value, setValue, localLoaded] = local;
  const [cloudMode, setCloudMode] = useState(false);
  const [cloudLoaded, setCloudLoaded] = useState(!supabase);
  const readyToSync = useRef(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const load = async () => {
      const client = supabase;
      if (!client) return;
      const { data } = await client.auth.getSession();
      if (!data.session) {
        if (active) setCloudLoaded(true);
        return;
      }
      try {
        const snapshot = await loadCloudSnapshot();
        if (active && snapshot) {
          setValue(select(snapshot));
          setCloudMode(true);
          readyToSync.current = true;
        }
      } finally {
        if (active) setCloudLoaded(true);
      }
    };
    void load();
    const listener = supabase.auth.onAuthStateChange(() => {
      readyToSync.current = false;
      setCloudLoaded(false);
      void load();
    });
    return () => { active = false; listener.data.subscription.unsubscribe(); };
  // The caller supplies stable imported sync functions; snapshot selection is
  // intentionally performed once per auth-session transition.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (localLoaded && cloudLoaded && cloudMode && readyToSync.current) void sync(value);
  }, [cloudLoaded, cloudMode, localLoaded, sync, value]);

  return [value, setValue, localLoaded && cloudLoaded] as const;
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
  const local = usePersisted<Customer[]>("debtbook.v2.customers", [], {
    migrate: migrateCustomers,
    validate: Array.isArray,
    corruptMessage:
      "Saved customer data on this device could not be read. A copy was kept so nothing was deleted.",
  });
  return useCloudBacked(local, (snapshot) => snapshot?.customers ?? [], syncCloudCustomers);
}

export function usePersistentProfile() {
  const local = usePersisted<BusinessProfile>("debtbook.v2.profile", emptyProfile, {
    migrate: (p) => ({ ...emptyProfile, ...p }),
    validate: isPlainObject,
    corruptMessage: "Your saved business profile could not be read and was reset on this device.",
  });
  return useCloudBacked(local, (snapshot) => snapshot?.profile ?? emptyProfile, syncCloudProfile);
}

export function useReminderHistory() {
  const local = usePersisted<ReminderRecord[]>("trackdebt.v3.reminders", [], {
    validate: Array.isArray,
  });
  return useCloudBacked(local, (snapshot) => snapshot?.reminders ?? [], syncCloudReminders);
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
  const [serverEntitlement, setServerEntitlement] = useState<ServerEntitlement>(freeEntitlement);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const entitlement = await fetchServerEntitlement();
        if (!cancelled) setServerEntitlement(entitlement);
      } catch {
        if (!cancelled) setServerEntitlement(freeEntitlement);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    void load();
    const subscription = supabase?.auth.onAuthStateChange(() => {
      setLoaded(false);
      void load();
    });
    return () => {
      cancelled = true;
      subscription?.data.subscription.unsubscribe();
    };
  }, []);

  return {
    entitlements: getEntitlements(serverEntitlement.plan),
    subscription: serverEntitlement,
    loaded,
  };
}


export function useNotificationSettings() {
  const local = usePersisted<NotificationSettings>(
    "trackdebt.v3.notification_settings",
    defaultNotificationSettings,
    { validate: isPlainObject }
  );
  return useCloudBacked(local, (snapshot) => snapshot?.notificationSettings ?? defaultNotificationSettings, syncCloudPreferences);
}

export function useInAppNotifications() {
  const local = usePersisted<InAppNotification[]>(
    "trackdebt.v3.in_app_notifications",
    [],
    { validate: Array.isArray }
  );
  return useCloudBacked(local, (snapshot) => snapshot?.notifications ?? [], syncCloudNotifications);
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
  const local = usePersisted<OnboardingState>("trackdebt.v3.onboarding", defaultOnboarding, {
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
  return useCloudBacked(local, (snapshot) => snapshot?.onboarding ?? defaultOnboarding, syncCloudOnboarding);
}

/** Receipt numbering lives in its own module; re-exported here so existing
 *  callers keep working. */
export { issueReceiptReference } from "./receipt-counter";
