import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { activateCloudOnlyStorage, clearLocalTrackDebtData, hasLocalBusinessData, migrateLocalData, wipeLocalDataAndActivateCloud } from "@/lib/local-migration";
import { deactivateCloudStorage } from "@/lib/storage-mode";
import { ensureCloudProfile } from "@/lib/cloud-data";
import { claimStoredPromoEntitlement, fetchAccountStatus, fetchServerEntitlement, restoreAccount } from "@/lib/subscription-api";

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

function CloudMigrationPrompt({ userId, onComplete }: { userId: string; onComplete: () => void }) {
  const [step, setStep] = useState<"choice" | "warning">("choice");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moveToCloud = async () => {
    setBusy(true);
    setError(null);
    try {
      await migrateLocalData(userId);
      toast.success("Your local data has been moved to your Track Debt account.");
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your data could not be moved to the cloud.");
      setBusy(false);
    }
  };

  const wipeLocal = () => {
    setBusy(true);
    setError(null);
    try {
      wipeLocalDataAndActivateCloud(userId);
      toast.success("Local data wiped. Your account is now using cloud storage.");
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Local data could not be wiped.");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-[430px] bg-paper-raised border border-line rounded-xl p-6 shadow-sm">
        <div className="h-12 w-12 rounded-full bg-debt/10 text-debt grid place-items-center text-xl mb-5">
          {step === "choice" ? "☁️" : "⚠️"}
        </div>

        {step === "choice" ? (
          <>
            <h1 className="text-xl font-bold">We found data on this device</h1>
            <p className="mt-3 text-sm text-ink-soft leading-relaxed">
              You have Track Debt records saved locally on this device. Move them to your Track Debt account so you can access them across devices.
            </p>
            <button onClick={() => void moveToCloud()} disabled={busy} className="btn-primary w-full rounded py-3 mt-7 text-sm font-semibold disabled:opacity-50">
              {busy ? "Moving your data…" : "Move data to cloud"}
            </button>
            <button onClick={() => setStep("warning")} disabled={busy} className="w-full rounded py-3 mt-2 text-sm font-semibold border border-line bg-paper disabled:opacity-50">
              Not now
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">Your local data will be wiped</h1>
            <p className="mt-3 text-sm text-ink-soft leading-relaxed">
              Your registered account uses cloud storage. The records currently saved on this device will not be transferred to your account and may be permanently deleted.
            </p>
            <button onClick={() => void moveToCloud()} disabled={busy} className="btn-primary w-full rounded py-3 mt-7 text-sm font-semibold disabled:opacity-50">
              {busy ? "Moving your data…" : "Move data to cloud"}
            </button>
            <button onClick={wipeLocal} disabled={busy} className="w-full rounded py-3 mt-2 text-sm font-semibold border border-destructive text-debt bg-paper disabled:opacity-50">
              Wipe local data
            </button>
          </>
        )}

        {error && <p className="mt-4 text-sm text-debt leading-relaxed">{error}</p>}
      </div>
    </main>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(!supabase);
  const [plusReady, setPlusReady] = useState(false);
  const [entitlementLoaded, setEntitlementLoaded] = useState(!supabase);
  const [accountStatus, setAccountStatus] = useState<"active" | "suspended" | "deletion_pending" | "deleted">("active");
  const [restorableUntil, setRestorableUntil] = useState<string | null>(null);
  const [migrationReady, setMigrationReady] = useState(false);
  // Track whether we've completed at least one full entitlement load so
  // we never blank the screen again on a background session refresh (tab
  // switch, phone wake, Supabase token auto-refresh). The app should only
  // ever show a blank loading screen on the very first cold start.
  const everLoaded = useRef(false);
  const hadSession = useRef(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let settled = false;

    // Never leave the entire app blocked forever if auth storage/network stalls.
    // A visitor can safely continue in local mode when no session is available.
    const timeout = window.setTimeout(() => {
      if (!active || settled) return;
      settled = true;
      setLoaded(true);
      setEntitlementLoaded(true);
    }, 6000);

    void supabase.auth.getSession().then(({ data }) => {
      if (!active || settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (data.session) hadSession.current = true;
      setSession(data.session);
      setLoaded(true);
    }).catch(() => {
      if (!active || settled) return;
      settled = true;
      window.clearTimeout(timeout);
      setSession(null);
      setLoaded(true);
      setEntitlementLoaded(true);
    });

    const listener = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      if (!nextSession) {
        if (hadSession.current) {
          // Clear local records before switching back to local mode. Avoid a hard
          // reload inside Supabase's auth callback, which can leave the SPA blank.
          clearLocalTrackDebtData();
        }
        hadSession.current = false;
        deactivateCloudStorage();
        setSession(null);
        setPlusReady(false);
        setEntitlementLoaded(true);
        setMigrationReady(true);
        setLoaded(true);
        return;
      }
      hadSession.current = true;
      setSession(nextSession);
      setMigrationReady(false);
      setLoaded(true);
    });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      listener.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      deactivateCloudStorage();
      setPlusReady(false);
      setEntitlementLoaded(true);
      setMigrationReady(false);
      everLoaded.current = true;
      return;
    }
    // Don't reset entitlementLoaded to false if we've already shown the
    // app once — this prevents the 15-20 second blank screen on resume.
    if (!everLoaded.current) {
      setEntitlementLoaded(false);
    }
    void claimStoredPromoEntitlement();
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

  useEffect(() => {
    if (!session || !entitlementLoaded || accountStatus !== "active") return;
    // Migration history must not suppress the prompt when new local data has
    // been created since a previous login/logout cycle.
    if (!hasLocalBusinessData()) {
      try {
        activateCloudOnlyStorage(session.user.id);
        window.localStorage.setItem(`trackdebt.v4.cloudMigration.${session.user.id}`, "completed");
        setMigrationReady(true);
      } catch {
        setMigrationReady(false);
      }
    }
  }, [session, entitlementLoaded, accountStatus]);

  // Read local storage once per relevant state change instead of on every render.
  const localDataPresent = useMemo(
    () => (session && entitlementLoaded && accountStatus === "active" ? hasLocalBusinessData() : false),
    // migrationReady flips after migrate/wipe, which changes the answer.
    [session, entitlementLoaded, accountStatus, migrationReady],
  );

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
  if (!session) return <div key="local" className="contents">{children}</div>;
  if (accountStatus === "suspended") return <main className="min-h-screen bg-background flex items-center justify-center p-6"><div className="max-w-sm text-center"><h1 className="text-xl font-bold">Account suspended</h1><p className="mt-2 text-sm text-ink-soft">Your Track Debt account has been suspended. Contact support if you believe this was a mistake.</p></div></main>;
  if (accountStatus === "deletion_pending") return <RestoreAccountPrompt deadline={restorableUntil} />;
  if (accountStatus === "deleted") return <main className="min-h-screen bg-background flex items-center justify-center p-6"><p className="max-w-sm text-center text-sm text-ink-soft">This account is no longer available.</p></main>;
  if (session && entitlementLoaded && accountStatus === "active" && localDataPresent) {
    return <CloudMigrationPrompt userId={session.user.id} onComplete={() => setMigrationReady(true)} />;
  }
  if (session && accountStatus === "active" && !migrationReady && !localDataPresent) {
    return <main className="min-h-screen bg-background flex items-center justify-center"><p className="text-sm text-ink-soft">Preparing your account…</p></main>;
  }
  // Remount app state when the active account changes or the user signs out,
  // so in-memory React state cannot keep showing the previous account's records.
  return <div key={session?.user.id ?? "local"} className="contents">{children}</div>;
}