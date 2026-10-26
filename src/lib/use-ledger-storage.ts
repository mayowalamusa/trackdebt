import { useEffect, useRef, useState } from "react";
import type { BusinessProfile, Customer, Txn } from "./ledger";
import { emptyProfile } from "./ledger";
import type { ReminderRecord } from "./reminders";
import { defaultNotificationSettings, type InAppNotification, type NotificationSettings } from "./notifications";
import { getEntitlements, type PromoEntitlement } from "./subscription";
import { fetchServerEntitlement, freeEntitlement, type ServerEntitlement } from "./subscription-api";
import { supabase } from "./supabase";
import { loadCloudSnapshot, syncCloudCustomers, syncCloudNotifications, syncCloudOnboarding, syncCloudPreferences, syncCloudProfile, syncCloudReminders } from "./cloud-data";
import { setActiveCurrency } from "./currency/formatter";

function useMemoryState<T>(initial: T) {
  return useState<T>(initial);
}

function useCloudBacked<T>(
  initial: T,
  local: readonly [T, React.Dispatch<React.SetStateAction<T>>],
  select: (snapshot: Awaited<ReturnType<typeof loadCloudSnapshot>>) => T,
  sync: (value: T) => Promise<void>,
) {
  const [value, setValue] = local;
  const [cloudActive, setCloudActive] = useState(false);
  const [loaded, setLoaded] = useState(!supabase);
  const initialValue = useRef(value);
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;

    const load = async () => {
      // Keep the current UI mounted during auth refreshes (e.g. when the app resumes).
      // Initial loading is already represented by the hook's initial loaded=false state.
      try {
        const { data } = await client.auth.getSession();
        if (!data.session) {
          if (active) {
            setCloudActive(false);
            setValue(initialValue.current);
            setLoaded(true);
          }
          return;
        }

        const snapshot = await loadCloudSnapshot();
        if (!active) return;

        const cloudValue = select(snapshot);
        const currentIsInitial = JSON.stringify(valueRef.current) === JSON.stringify(initialValue.current);
        const cloudIsInitial = JSON.stringify(cloudValue) === JSON.stringify(initialValue.current);

        // A signed-in user is cloud-backed. If they created data during this
        // anonymous session and the account is still empty, keep that in-memory
        // data and upload it; otherwise the server is authoritative.
        if (!cloudIsInitial || currentIsInitial) {
          setValue(cloudValue);
        }
        setCloudActive(true);
        setLoaded(true);
      } catch {
        if (active) {
          setCloudActive(false);
          setLoaded(true);
        }
      }
    };

    void load();
    const listener = client.auth.onAuthStateChange(() => {
      void load();
    });
    return () => {
      active = false;
      listener.data.subscription.unsubscribe();
    };
  // Auth transitions are the only events that should reload cloud state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loaded && cloudActive) void sync(value);
  }, [cloudActive, loaded, sync, value]);

  return [value, setValue, loaded, cloudActive] as const;
}

const VISITOR_CUSTOMERS_CACHE_KEY = "trackdebt.visitor-customers.v1";

function readVisitorCustomers(): Customer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(VISITOR_CUSTOMERS_CACHE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as Customer[] : [];
  } catch {
    return [];
  }
}

export function usePersistentCustomers() {
  // Visitors have no cloud identity, so persist their ledger on this device only.
  // Signed-in customer data remains cloud-backed and is never written to the shared guest cache.
  const local = useState<Customer[]>(() => readVisitorCustomers());
  const [customers, setCustomers, loaded, cloudActive] = useCloudBacked(
    [],
    local,
    (snapshot) => snapshot?.customers ?? [],
    syncCloudCustomers,
  );
  useEffect(() => {
    if (!loaded || cloudActive || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(VISITOR_CUSTOMERS_CACHE_KEY, JSON.stringify(customers));
    } catch {
      // Keep the app usable if browser storage is unavailable or full.
    }
  }, [customers, loaded, cloudActive]);
  return [customers, setCustomers, loaded] as const;
}

export function usePersistentProfile() {
  // Signed-in business details are loaded from and saved to the account's cloud profile.
  // Do not use a shared local profile cache: it can leak one account's details into another.
  const local = useMemoryState<BusinessProfile>(emptyProfile);
  const [profile, setProfile, loaded] = useCloudBacked(
    emptyProfile,
    local,
    (snapshot) => snapshot?.profile ?? emptyProfile,
    syncCloudProfile,
  );
  useEffect(() => {
    if (loaded) setActiveCurrency(profile.currency);
  }, [loaded, profile.currency]);
  return [profile, setProfile, loaded] as const;
}

export function useReminderHistory() {
  const local = useMemoryState<ReminderRecord[]>([]);
  return useCloudBacked([], local, (snapshot) => snapshot?.reminders ?? [], syncCloudReminders);
}

export function usePromoEntitlements() {
  return useMemoryState<PromoEntitlement | null>(null);
}

export function useEntitlements(promoOverride?: PromoEntitlement | null) {
  const [serverEntitlement, setServerEntitlement] = useState<ServerEntitlement>(freeEntitlement);
  const [serverLoaded, setServerLoaded] = useState(false);
  const promo = promoOverride ?? null;

  useEffect(() => {
    if (!supabase) {
      setServerLoaded(true);
      return;
    }
    const client = supabase;
    let cancelled = false;
    let sequence = 0;

    const load = async () => {
      const mine = ++sequence;
      try {
        const { data } = await client.auth.getSession();
        if (!data.session) {
          if (!cancelled && mine === sequence) {
            setServerEntitlement(freeEntitlement);
            setServerLoaded(true);
          }
          return;
        }

        const entitlement = await fetchServerEntitlement();
        if (!cancelled && mine === sequence) {
          setServerEntitlement(entitlement);
          setServerLoaded(true);
        }
      } catch {
        // Never downgrade a known paid/promo state because of a transient
        // network or auth race. The next auth event/refresh retries the load.
        if (!cancelled && mine === sequence) setServerLoaded(true);
      }
    };

    void load();
    const listener = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setServerEntitlement(freeEntitlement);
        setServerLoaded(true);
        return;
      }
      void load();
    });
    return () => {
      cancelled = true;
      listener.data.subscription.unsubscribe();
    };
  }, []);

  const promoActive = !!promo?.expiresAt && Date.parse(promo.expiresAt) > Date.now();
  const effectivePlan =
    serverEntitlement.plan === "plus"
      ? "plus"
      : promoActive
        ? promo!.plan
        : "free";

  return {
    entitlements: getEntitlements(effectivePlan),
    subscription: serverEntitlement,
    loaded: serverLoaded,
  };
}

export function useNotificationSettings() {
  const local = useMemoryState<NotificationSettings>(defaultNotificationSettings);
  return useCloudBacked(
    defaultNotificationSettings,
    local,
    (snapshot) => snapshot?.notificationSettings ?? defaultNotificationSettings,
    syncCloudPreferences,
  );
}

export function useInAppNotifications() {
  const local = useMemoryState<InAppNotification[]>([]);
  const [notifications, setNotifications, loaded] = useCloudBacked(
    [],
    local,
    (snapshot) => snapshot?.notifications ?? [],
    syncCloudNotifications,
  );
  return [notifications, setNotifications, loaded] as const;
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
  const local = useMemoryState<OnboardingState>(defaultOnboarding);
  return useCloudBacked(
    defaultOnboarding,
    local,
    (snapshot) => snapshot?.onboarding ?? defaultOnboarding,
    syncCloudOnboarding,
  );
}

/** Receipt numbering lives in its own module; re-exported here so existing
 *  callers keep working. */
export { issueReceiptReference } from "./receipt-counter";
