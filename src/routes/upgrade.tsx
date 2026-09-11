import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  TrendingUp,
  Ban,
  Check,
  Zap,
  Clock,
  Mic,
  FileText,
  Sparkles,
  ShieldCheck,
  MessageCircle,
  MessageSquare,
  Users,
  Minus,
  LogIn,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/ledger";
import { COMPARISON, PLUS_BENEFITS, PREMIUM_BENEFITS } from "@/lib/app-config";
import { planLabel } from "@/lib/subscription";
import { cancelPlusSubscription, currentSession, deleteAccount, startPlusCheckout } from "@/lib/subscription-api";
import { supabase } from "@/lib/supabase";
import { useEntitlements } from "@/lib/use-ledger-storage";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/upgrade")({
  head: () => ({
    meta: [
      { title: `Upgrade — ${APP_NAME}` },
      {
        name: "description",
        content: "Explore upcoming Track Debt Plus and Premium features.",
      },
    ],
  }),
  component: UpgradePage,
});

const BENEFIT_ICONS: Record<string, any> = {
  ban: Ban,
  sparkles: Sparkles,
  mic: Mic,
  "file-text": FileText,
  "message-circle": MessageCircle,
  "shield-check": ShieldCheck,
  zap: Zap,
  "message-square": MessageSquare,
  clock: Clock,
  users: Users,
  "bar-chart": TrendingUp,
};

function UpgradePage() {
  const { entitlements, subscription } = useEntitlements();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up" | "recovery">("sign-in");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    track("upgrade_page_viewed");
    void currentSession().then((session) => setUserEmail(session?.user.email ?? null));
    const listener = supabase?.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
    });
    return () => listener?.data.subscription.unsubscribe();
  }, []);

  const authenticate = async () => {
    if (!supabase) {
      setMessage("Account sign-in is not configured yet.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (authMode === "recovery") {
        const result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/upgrade` });
        if (result.error) throw result.error;
        setMessage("Check your email for a password recovery link.");
      } else if (authMode === "sign-in") {
        const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw result.error;
        setMessage("Signed in.");
      } else {
        const result = await supabase.auth.signUp({ email: email.trim(), password });
        if (result.error) throw result.error;
        setMessage(result.data.session ? "Signed in." : "Check your email to confirm your account.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not authenticate.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    setMessage("Signed out. Plus access is no longer available on this device.");
  };

  const upgrade = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const checkout = await startPlusCheckout();
      window.location.assign(checkout.authorization_url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start checkout.");
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await cancelPlusSubscription();
      setMessage("Cancellation requested. Plus remains active until the paid period ends.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not cancel the subscription.");
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = async () => {
    if (!window.confirm("Start the 30-day account deletion period? Your account can be restored during that period.")) return;
    setBusy(true);
    try {
      await deleteAccount();
      await supabase?.auth.signOut();
      setMessage("Account deletion started. Contact support within 30 days to request restoration.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start account deletion.");
    } finally {
      setBusy(false);
    }
  };

  const dateLabel = (value: string | null) => value ? new Date(value).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "Not available yet";

  return (
    <main className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-paper relative pb-16">
        <header className="flex items-center gap-2 px-3 pt-6 pb-5 border-b border-line bg-paper-raised">
          <Link
            to="/"
            aria-label="Back"
            className="h-11 w-11 grid place-items-center rounded text-ink"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
          <h1 className="font-semibold text-lg truncate">Plans & Upgrades</h1>
        </header>

        <div className="p-5">
          {entitlements.plan === "plus" && (
            <div className="rounded-xl border border-paid bg-paid/5 px-4 py-5 text-center mb-8 animate-in fade-in zoom-in duration-300">
              <p className="text-sm font-bold text-paid flex items-center justify-center gap-2">
                <Check size={16} /> Active Plan: {planLabel(entitlements.plan)}
              </p>
              <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">
                Your Plus access is active through {dateLabel(subscription.currentPeriodEnd)}.
              </p>
              <p className="text-[11px] text-ink-soft mt-1">Status: {subscription.status}</p>
              {subscription.cancelledAt ? (
                <p className="text-[11px] text-debt mt-1">Cancellation requested; no further renewal is expected.</p>
              ) : null}
            </div>
          )}

          <div className="text-center mb-8 mt-2">
            <h2 className="text-2xl font-bold">Plans & features</h2>
            <p className="mt-1.5 text-sm font-medium text-ink-soft">
              Track Debt Plus keeps renewing monthly until you cancel.
            </p>
          </div>

          {message && <p className="mb-5 rounded-lg border border-line bg-paper-raised px-3 py-2 text-xs text-ink-soft">{message}</p>}

          {!userEmail ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void authenticate();
              }}
              className="mb-8 rounded-xl border border-line bg-paper-raised p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <LogIn size={16} />
                <h3 className="font-semibold">Sign in to manage Plus</h3>
              </div>
              <p className="text-xs text-ink-soft mb-4">Plus belongs to your Track Debt account and follows you across devices.</p>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required placeholder="Email address" className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm mb-2" />
              {authMode !== "recovery" && <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required minLength={6} placeholder="Password" className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />}
              <button type="submit" disabled={busy} className="w-full mt-3 rounded-lg bg-ink py-3 text-sm font-semibold text-paper disabled:opacity-50">
                {busy ? "Please wait…" : authMode === "recovery" ? "Send recovery link" : authMode === "sign-in" ? "Sign in" : "Create account"}
              </button>
              <button type="button" onClick={() => setAuthMode(authMode === "sign-up" ? "sign-in" : "sign-up")} className="w-full mt-2 py-2 text-xs text-ink-soft">
                {authMode === "sign-up" ? "Already have an account? Sign in" : "Need an account? Create one"}
              </button>
              <button type="button" onClick={() => setAuthMode(authMode === "recovery" ? "sign-in" : "recovery")} className="w-full py-2 text-xs text-ink-soft">
                {authMode === "recovery" ? "Back to sign in" : "Forgot password?"}
              </button>
            </form>
          ) : (
            <div className="mb-8 flex items-center justify-between rounded-lg border border-line bg-paper-raised px-3 py-2 text-xs">
              <span className="truncate">Signed in as {userEmail}</span>
              <button type="button" onClick={() => void signOut()} className="ml-3 inline-flex shrink-0 items-center gap-1 text-ink-soft"><LogOut size={13} /> Sign out</button>
            </div>
          )}
          {userEmail && <button type="button" onClick={() => void removeAccount()} disabled={busy} className="mb-6 w-full text-xs text-debt disabled:opacity-50">Delete account</button>}

          <div className="space-y-4 mb-8">
            <div
              className={`rounded-xl border p-4 bg-paper-raised ${
                entitlements.plan === "free" ? "border-ink ring-1 ring-ink" : "border-line"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-lg">FREE</h3>
                  <p className="text-[11px] text-ink-soft uppercase tracking-wider font-semibold">
                    Available now
                  </p>
                </div>
                <p className="text-xl font-bold mono">₦0</p>
              </div>
              <p className="text-xs text-ink-soft mb-4">
                Customer management, debt tracking, due-date notifications and WhatsApp sharing.
              </p>
              {entitlements.plan === "free" && (
                <div className="text-center py-2 px-4 rounded-lg bg-ink/5 text-ink text-[11px] font-bold">
                  YOUR CURRENT PLAN
                </div>
              )}
            </div>

            <div className={`rounded-xl border p-4 bg-paper-raised ${entitlements.plan === "plus" ? "border-paid ring-1 ring-paid" : "border-line"}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-lg">PLUS</h3>
                  <p className="text-[11px] text-ink-soft uppercase tracking-wider font-semibold">
                    ₦1,000/month
                  </p>
                </div>
                <p className="text-sm font-bold mono text-paid">₦1,000</p>
              </div>
              <p className="text-xs text-ink-soft mb-4">
                AI reminders, premium templates, voice entry, PDF receipts and additional business tools.
              </p>
              {userEmail && entitlements.plan === "free" && <button onClick={() => void upgrade()} disabled={busy} className="w-full rounded-lg bg-ink py-3 text-[11px] font-bold text-paper disabled:opacity-50">START PLUS CHECKOUT</button>}
              {!userEmail && <div className="text-center py-2 px-4 rounded-lg border border-line text-ink-soft text-[11px] font-bold">SIGN IN TO START</div>}
              {entitlements.plan === "plus" && <button onClick={() => void cancel()} disabled={busy || !!subscription.cancelledAt} className="w-full rounded-lg border border-line py-3 text-[11px] font-bold text-ink-soft disabled:opacity-50">{subscription.cancelledAt ? "CANCELLATION REQUESTED" : "CANCEL RENEWAL"}</button>}
            </div>

            <div className="rounded-xl border border-dashed border-line p-4 bg-paper-raised opacity-80">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-lg text-ink-soft">PREMIUM</h3>
                  <p className="text-[11px] text-ink-soft uppercase tracking-wider font-semibold">
                    For advanced automation
                  </p>
                </div>
                <p className="text-sm font-bold mono text-debt">Coming Soon</p>
              </div>
              <p className="text-xs text-ink-soft mb-4">
                Full automation, bulk messaging and advanced analytics are planned for a future release.
              </p>
              <div className="text-center py-2 px-4 rounded-lg border border-line text-ink-soft text-[11px] font-bold">
                NOT YET AVAILABLE
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h4 className="mono text-[11px] tracking-widest text-ink-soft mb-4">PLUS BENEFITS</h4>
            <div className="grid grid-cols-1 gap-4">
              {PLUS_BENEFITS.map((b) => {
                const Icon = BENEFIT_ICONS[b.icon] ?? Sparkles;
                return (
                  <div key={b.title} className="flex items-start gap-3">
                    <span className="h-8 w-8 shrink-0 rounded-full bg-ink/5 text-ink grid place-items-center">
                      <Icon size={15} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{b.title}</p>
                      <p className="text-[11px] text-ink-soft">{b.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mb-8">
            <h4 className="mono text-[11px] tracking-widest text-ink-soft mb-4">PREMIUM COMING SOON</h4>
            <div className="grid grid-cols-1 gap-4">
              {PREMIUM_BENEFITS.map((b) => {
                const Icon = BENEFIT_ICONS[b.icon] ?? Sparkles;
                return (
                  <div key={b.title} className="flex items-start gap-3 opacity-60">
                    <span className="h-8 w-8 shrink-0 rounded-full bg-debt/5 text-debt grid place-items-center">
                      <Icon size={15} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{b.title}</p>
                      <p className="text-[11px] text-ink-soft">{b.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mono text-[11px] tracking-widest text-ink-soft mb-2 uppercase">Feature Comparison</p>
          <div className="rounded-lg border border-line overflow-hidden mb-6">
            <div className="grid grid-cols-[1fr,45px,45px,45px] bg-paper-raised text-[9px] font-bold text-ink-soft px-3 py-2 uppercase tracking-tighter">
              <span>Feature</span>
              <span className="text-center">Free</span>
              <span className="text-center">Plus</span>
              <span className="text-center">Prem.</span>
            </div>
            {COMPARISON.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-[1fr,45px,45px,45px] items-center px-3 py-2.5 text-[11px] ${
                  i % 2 === 1 ? "bg-paper-raised/50" : ""
                }`}
              >
                <span className="pr-2 font-medium">{row.feature}</span>
                <span className="flex justify-center">
                  {row.free ? <Check size={12} className="text-paid" /> : <Minus size={12} className="text-ink-soft/30" />}
                </span>
                <span className="flex justify-center">
                  {row.plus ? <Check size={12} className="text-paid" /> : <Minus size={12} className="text-ink-soft/30" />}
                </span>
                <span className="flex justify-center">
                  {row.premium ? <Check size={12} className="text-paid" /> : <Minus size={12} className="text-ink-soft/30" />}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <p className="text-[10px] text-ink-soft text-center leading-relaxed px-4">
              Payment is processed by Paystack. Plus renews monthly until cancelled. Access begins only after Track Debt confirms the Paystack webhook.
            </p>
            <p className="text-[10px] text-ink-soft text-center">Next payment: {dateLabel(subscription.nextPaymentAt)}</p>
            <button type="button" onClick={() => window.location.reload()} className="mx-auto flex items-center gap-1 text-[11px] text-ink-soft"><RefreshCw size={12} /> Refresh subscription status</button>
          </div>
        </div>
      </div>
    </main>
  );
}
