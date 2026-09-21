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
  // Track whether we've completed at least one full entitlement load so
  // we never blank the screen again on a background session refresh (tab
  // switch, phone wake, Supabase token auto-refresh). The app should only
  // ever show a blank loading screen on the very first cold start.
  const everLoaded = useRef(false);

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
      everLoaded.current = true;
      return;
    }
    // Don't reset entitlementLoaded to false if we've already shown the
    // app once — this prevents the 15-20 second blank screen on resume.
    if (!everLoaded.current) {
      setEntitlementLoaded(false);
    }
    void Promise.all([ensureCloudProfile(), fetchAccountStatus(), fetchServerEntitlement()]).then(([, account, entitlement]) => {
      setAccountStatus(account.status);
      setRestorableUntil(account.restorableUntil);
      if (account.status !== "active") {
        setPlusReady(false);
        setEntitlementLoaded(true);
        everLoaded.current = true;
        return;
      }
      setPlusReady(entitlement.plan === "plus");
      setEntitlementLoaded(true);
      everLoaded.current = true;
    }).catch(() => {
      setPlusReady(false);
      setEntitlementLoaded(true);
      everLoaded.current = true;
    });
  }, [session]);

  useBackgroundBackup(session?.user.id ?? null, plusReady && accountStatus === "active");

  if (!supabase) return <>{children}</>;
  // Only block rendering on the very first cold load.
  if (!loaded || (!entitlementLoaded && !everLoaded.current)) return (
    <main className="min-h-screen bg-paper flex flex-col items-center justify-center gap-5">
      <div className="h-20 w-20 rounded-[22px] bg-debt grid place-items-center shadow-sm">
        <svg viewBox="0 0 512 512" className="h-12 w-12" aria-hidden="true">
          <path d="M 110,300 A 146,146 0 0 1 402,300" fill="none" stroke="#ffffff" strokeWidth="30" strokeLinecap="round" />
          <path d="M 241,304 L 256,176 L 271,304 Z" fill="#ffffff" />
          <circle cx="256" cy="304" r="20" fill="#ffffff" />
          <rect x="196" y="330" width="120" height="32" rx="16" fill="#ffffff" />
          <rect x="166" y="370" width="180" height="32" rx="16" fill="#ffffff" />
          <rect x="136" y="410" width="240" height="32" rx="16" fill="#ffffff" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-ink-soft tracking-wide">Track Debt</p>
    </main>
  );
  if (!session) return <>{children}</>;
  if (accountStatus === "deletion_pending") return <RestoreAccountPrompt deadline={restorableUntil} />;
  if (accountStatus === "deleted") return <main className="min-h-screen bg-background flex items-center justify-center p-6"><p className="max-w-sm text-center text-sm text-ink-soft">This account is no longer available.</p></main>;
  if (plusReady && !hasCompletedMigration(session.user.id) && !hasLocalBusinessData()) {
    try { window.localStorage.setItem(`trackdebt.v4.cloudMigration.${session.user.id}`, "completed"); } catch { /* storage is optional */ }
  }
  return <>{children}</>;
}