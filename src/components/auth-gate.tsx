import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { hasCompletedMigration, hasLocalBusinessData, migrateLocalData } from "@/lib/local-migration";
import { ensureCloudProfile } from "@/lib/cloud-data";

function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup" | "recovery">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "recovery") {
        const result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/` });
        if (result.error) throw result.error;
        setMessage("Check your email for a password recovery link.");
      } else {
        const result = mode === "login"
          ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
          : await supabase.auth.signUp({ email: email.trim(), password });
        if (result.error) throw result.error;
        if (mode === "signup" && !result.data.session) setMessage("Check your email to confirm your account.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex justify-center">
      <form onSubmit={submit} className="w-full max-w-[430px] min-h-screen bg-paper p-6 pt-20">
        <h1 className="text-2xl font-bold">Track Debt</h1>
        <p className="mt-2 text-sm text-ink-soft">{mode === "recovery" ? "Recover your account" : mode === "signup" ? "Create your Track Debt account" : "Sign in to continue"}</p>
        <input className="input-field w-full rounded px-3 py-3 mt-8 text-sm" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" />
        {mode !== "recovery" && <input className="input-field w-full rounded px-3 py-3 mt-3 text-sm" type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />}
        <button disabled={busy} className="btn-primary w-full rounded py-3 mt-4 text-sm font-semibold disabled:opacity-50">{busy ? "Please wait…" : mode === "recovery" ? "Send recovery link" : mode === "signup" ? "Create account" : "Sign in"}</button>
        {message && <p className="mt-4 text-sm text-ink-soft">{message}</p>}
        <div className="flex flex-col items-center gap-2 mt-6 text-xs text-ink-soft">
          <button type="button" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>{mode === "signup" ? "Already have an account? Sign in" : "Create an account"}</button>
          <button type="button" onClick={() => setMode(mode === "recovery" ? "login" : "recovery")}>{mode === "recovery" ? "Back to sign in" : "Forgot password?"}</button>
        </div>
      </form>
    </main>
  );
}

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

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setLoaded(true); } });
    const listener = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setLoaded(true); });
    return () => { active = false; listener.data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (session) void ensureCloudProfile();
  }, [session]);

  if (!supabase) return <>{children}</>;
  if (!loaded) return <main className="min-h-screen bg-background" />;
  if (!session) return <AuthForm />;
  if (!hasCompletedMigration(session.user.id) && hasLocalBusinessData()) return <MigrationPrompt userId={session.user.id} />;
  if (!hasCompletedMigration(session.user.id)) {
    try { window.localStorage.setItem(`trackdebt.v4.cloudMigration.${session.user.id}`, "completed"); } catch { /* storage is optional */ }
  }
  return <>{children}</>;
}