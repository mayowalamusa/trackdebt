import { useEffect, useState } from "react";
import type { Customer } from "./ledger";
import { seed } from "./ledger";

const KEY = "debtbook.v1";

export function usePersistentCustomers() {
  const [customers, setCustomers] = useState<Customer[]>(seed);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setCustomers(JSON.parse(raw) as Customer[]);
    } catch {
      /* ignore corrupt storage */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(customers));
    } catch {
      /* ignore quota errors */
    }
  }, [customers, loaded]);

  return [customers, setCustomers] as const;
}

const NAME_KEY = "debtbook.business";

export function usePersistentBusinessName(initial: string) {
  const [name, setName] = useState(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(NAME_KEY);
    if (stored) setName(stored);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) window.localStorage.setItem(NAME_KEY, name);
  }, [name, loaded]);

  return [name, setName] as const;
}
