import { useEffect, useState } from "react";
import type { BusinessProfile, Customer } from "./ledger";
import { emptyProfile } from "./ledger";

function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore corrupt storage */
    }
    setLoaded(true);
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

export function usePersistentCustomers() {
  const [customers, setCustomers, loaded] = usePersisted<Customer[]>("debtbook.v2.customers", []);
  return [customers, setCustomers, loaded] as const;
}

export function usePersistentProfile() {
  const [profile, setProfile, loaded] = usePersisted<BusinessProfile>(
    "debtbook.v2.profile",
    emptyProfile,
  );
  return [profile, setProfile, loaded] as const;
}
