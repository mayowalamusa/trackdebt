import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { BusinessProfile, Customer, Txn } from "./ledger";
import { emptyProfile } from "./ledger";
import type { ReminderRecord } from "./reminders";
import { defaultNotificationSettings, type InAppNotification, type NotificationSettings } from "./notifications";
import { getEntitlements, type PromoEntitlement } from "./subscription";
import { fetchServerEntitlement, freeEntitlement, type ServerEntitlement } from "./subscription-api";
import { supabase } from "./supabase";
import { loadCloudSnapshot, loadCloudNotifications, syncCloudCustomers, syncCloudNotifications, syncCloudOnboarding, syncCloudPreferences, syncCloudProfile, syncCloudReminders } from "./cloud-data";
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
  const initialValue = useRef(initial);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;

    const load = async () => {
      setLoaded(false);
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
        const currentIsInitial = JSON.stringify(value) === JSON.stringify(initialValue.current);
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

  return [value, setValue, loaded] as const;
}

export function usePersistentCustomers() {
  const local = useMemoryState<Customer[]>([]);
  return useCloudBacked([], local, (snapshot) => snapshot?.customers ?? [], syncCloudCustomers);
}

export function usePersistentProfile() {
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
