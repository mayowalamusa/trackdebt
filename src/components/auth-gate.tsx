import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  fetchAccountStatus,
  restoreAccount,
} from "@/lib/subscription-api";
import { ensureCloudProfile } from "@/lib/cloud-data";

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

  return (
    <main className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-paper p-6 pt-20">
        <h1 className="text-2xl font-bold">Restore your account</h1>
        <p className="mt-3 text-sm text-ink-soft">
          This account is scheduled for deletion, but it can still be restored before the server
          deadline.
        </p>
        <p className="mt-2 text-xs text-ink-soft">
          Restoration deadline:{" "}
          {deadline
            ? new Date(deadline).toLocaleDateString("en-NG", { dateStyle: "medium" })
            : "Unavailable"}
        </p>
        <button
          onClick={() => void restore()}
          disabled={busy}
          className="btn-primary w-full rounded py-3 mt-8 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Restoring…" : "Restore Account"}
        </button>
        {message && <p className="mt-4 text-sm text-debt">{message}</p>}
      </div>
    </main>
  );
}

/**
 * Track Debt deliberately does not persist business data in browser storage.
 * Anonymous/free users can use the app, but their records live only in memory
 * for the current page session. Signed-in users are backed by Supabase cloud
 * storage. Authentication itself still uses Supabase's session mechanism.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(!supabase);
  const [accountStatus, setAccountStatus] = useState<
    "active" | "suspended" | "deletion_pending" | "deleted"
  >("active");
  const [restorableUntil, setRestorableUntil] = useState<string | null>(null);
  const everLoaded = useRef(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const client = supabase;

    const loadSession = async () => {
      try {
        const { data } = await client.auth.getSession();
        if (!active) return;
        setSession(data.session);
        setLoaded(true);
      } catch {
        if (!active) return;
        setSession(null);
        setLoaded(true);
      }
    };

    void loadSession();
    const listener = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoaded(true);
    });

    return () => {
      active = false;
      listener.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setAccountStatus("active");
      setRestorableUntil(null);
      everLoaded.current = true;
      return;
    }

    let active = true;
    void Promise.all([ensureCloudProfile(), fetchAccountStatus()])
      .then(([, account]) => {
        if (!active) return;
        setAccountStatus(account.status);
        setRestorableUntil(account.restorableUntil);
        everLoaded.current = true;
      })
      .catch(() => {
        if (!active) return;
        // Keep the normal app usable during a transient account-status outage.
        setAccountStatus("active");
        setRestorableUntil(null);
        everLoaded.current = true;
      });

    return () => {
      active = false;
    };
  }, [session]);

  if (!supabase) return <>{children}</>;
  if (!loaded && !everLoaded.current) {
    return (
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
  }

  if (!session) {
    return <div key="anonymous" className="contents">{children}</div>;
  }

  if (accountStatus === "suspended") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-bold">Account suspended</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Your Track Debt account has been suspended. Contact support if you believe this was a mistake.
          </p>
        </div>
      </main>
    );
  }

  if (accountStatus === "deletion_pending") {
    return <RestoreAccountPrompt deadline={restorableUntil} />;
  }

  if (accountStatus === "deleted") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="max-w-sm text-center text-sm text-ink-soft">
          This account is no longer available.
        </p>
      </main>
    );
  }

  return (
    <div key={session.user.id} className="contents">
      {children}
    </div>
  );
}
