import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { hasCompletedMigration, hasLocalBusinessData, migrateLocalData } from "@/lib/local-migration";
import { ensureCloudProfile } from "@/lib/cloud-data";
import { fetchAccountStatus, fetchServerEntitlement } from "@/lib/subscription-api";

function MigrationPrompt({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const migrate = async () => {
    setBusy(true);
    try {
      await migrateLocalData(userId);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not import local data.");
      setBusy(false);
    }
  };
  return <main className="min-h-screen bg-background flex justify-center"><div className="w-full max-w-[430px] min-h-screen bg-paper p-6 pt-20"><h1 className="text-2xl font-bold">Import your existing data</h1><p className="mt-3 text-sm text-ink-soft">This device has Track Debt records. Import them into your account before continuing. Local data is kept until the import succeeds.</p><button onClick={() => void migrate()} disabled={busy} className="btn-primary w-full rounded py-3 mt-8 text-sm font-semibold disabled:opacity-50">{busy ? "Importing…" : "Import and continue"}</button>{message && <p className="mt-4 text-sm text-debt">{message}</p>}</div></main>;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(!supabase);
  const [plusReady, setPlusReady] = useState(false);
  const [entitlementLoaded, setEntitlementLoaded] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setLoaded(true); } });
    const listener = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setLoaded(true); });
    return () => { active = false; listener.data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) {
      setPlusReady(false);
      setEntitlementLoaded(true);
      return;
    }
    setEntitlementLoaded(false);
    void Promise.all([ensureCloudProfile(), fetchAccountStatus(), fetchServerEntitlement()]).then(([, account, entitlement]) => {
      if (account.status !== "active") {
        void supabase?.auth.signOut();
        setPlusReady(false);
        setEntitlementLoaded(true);
        return;
      }
      setPlusReady(entitlement.plan === "plus");
      setEntitlementLoaded(true);
    }).catch(() => {
      setPlusReady(false);
      setEntitlementLoaded(true);
    });
  }, [session]);

  if (!supabase) return <>{children}</>;
  if (!loaded || !entitlementLoaded) return <main className="min-h-screen bg-background" />;
  // Anonymous users stay in the existing local Free mode. Authentication is
  // required only when the user chooses to upgrade or recover a Plus account.
  if (!session) return <>{children}</>;
  if (plusReady && !hasCompletedMigration(session.user.id) && hasLocalBusinessData()) return <MigrationPrompt userId={session.user.id} />;
  if (plusReady && !hasCompletedMigration(session.user.id) && !hasLocalBusinessData()) {
    try { window.localStorage.setItem(`trackdebt.v4.cloudMigration.${session.user.id}`, "completed"); } catch { /* storage is optional */ }
  }
  return <>{children}</>;
}