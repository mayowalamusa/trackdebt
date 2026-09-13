import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { hasCompletedMigration, hasLocalBusinessData, migrateLocalData } from "@/lib/local-migration";
import { ensureCloudProfile } from "@/lib/cloud-data";
import { fetchAccountStatus, fetchServerEntitlement, restoreAccount } from "@/lib/subscription-api";

function RestoreAccountPrompt({ deadline }: { deadline: string | null }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const restore = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await restoreAccount();
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not restore the account.");
      setBusy(false);
    }
  };
  return <main className="min-h-screen bg-background flex justify-center"><div className="w-full max-w-[430px] min-h-screen bg-paper p-6 pt-20"><h1 className="text-2xl font-bold">Restore your account</h1><p className="mt-3 text-sm text-ink-soft">This account is scheduled for deletion, but it can still be restored before the server deadline.</p><p className="mt-2 text-xs text-ink-soft">Restoration deadline: {deadline ? new Date(deadline).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "Unavailable"}</p><button onClick={() => void restore()} disabled={busy} className="btn-primary w-full rounded py-3 mt-8 text-sm font-semibold disabled:opacity-50">{busy ? "Restoring…" : "Restore Account"}</button>{message && <p className="mt-4 text-sm text-debt">{message}</p>}</div></main>;
}

// Backing up local records into the paid account happens silently in the
// background; the user is never blocked by an import screen.
function useBackgroundBackup(userId: string | null, ready: boolean) {
  const started = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !userId || started.current === userId) return;
    if (hasCompletedMigration(userId) || !hasLocalBusinessData()) return;
    started.current = userId;
    void migrateLocalData(userId)
      .then(() => toast.success("Your records are now backed up to your account."))
      .catch(() => toast.error("Backup didn't finish — we'll retry next time you open the app."));
  }, [userId, ready]);
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(!supabase);
  const [plusReady, setPlusReady] = useState(false);
  const [entitlementLoaded, setEntitlementLoaded] = useState(!supabase);
  const [accountStatus, setAccountStatus] = useState<"active" | "deletion_pending" | "deleted">("active");
  const [restorableUntil, setRestorableUntil] = useState<string | null>(null);

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
      setAccountStatus(account.status);
      setRestorableUntil(account.restorableUntil);
      if (account.status !== "active") {
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
  if (accountStatus === "deletion_pending") return <RestoreAccountPrompt deadline={restorableUntil} />;
  if (accountStatus === "deleted") return <main className="min-h-screen bg-background flex items-center justify-center p-6"><p className="max-w-sm text-center text-sm text-ink-soft">This account is no longer available.</p></main>;
  if (plusReady && !hasCompletedMigration(session.user.id) && hasLocalBusinessData()) return <MigrationPrompt userId={session.user.id} />;
  if (plusReady && !hasCompletedMigration(session.user.id) && !hasLocalBusinessData()) {
    try { window.localStorage.setItem(`trackdebt.v4.cloudMigration.${session.user.id}`, "completed"); } catch { /* storage is optional */ }
  }
  return <>{children}</>;
}