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
  RotateCcw,
  Sparkles,
  ShieldCheck,
  MessageCircle,
  MessageSquare,
  Users,
  Minus,
} from "lucide-react";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/ledger";
import { COMPARISON, PLUS_BENEFITS, PREMIUM_BENEFITS } from "@/lib/app-config";
import { paymentService, planLabel, isPro } from "@/lib/subscription";
import { useSubscription, useEntitlements } from "@/lib/use-ledger-storage";
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
  const [sub, setSub] = useSubscription();
  const { entitlements } = useEntitlements();
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    track("upgrade_page_viewed");
  }, []);

  const restore = async () => {
    setRestoring(true);
    try {
      const restored = await paymentService.restore();
      setSub(restored);
      toast(
        restored.state.includes("active")
          ? `${planLabel(entitlements.plan)} restored.`
          : "No active purchase found on this device.",
      );
    } catch {
      toast.error("Could not restore purchase. Please try again.");
    } finally {
      setRestoring(false);
    }
  };

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
          {isPro(sub) && (
            <div className="rounded-xl border border-paid bg-paid/5 px-4 py-5 text-center mb-8 animate-in fade-in zoom-in duration-300">
              <p className="text-sm font-bold text-paid flex items-center justify-center gap-2">
                <Check size={16} /> Active Plan: {planLabel(entitlements.plan)}
              </p>
              <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">
                Thanks for supporting {APP_NAME}. Your premium features are active on this device.
              </p>
            </div>
          )}

          <div className="text-center mb-8 mt-2">
            <h2 className="text-2xl font-bold">Plans & features</h2>
            <p className="mt-1.5 text-sm font-medium text-ink-soft">
              Premium features are being prepared for launch.
            </p>
          </div>

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

            <div className="rounded-xl border border-dashed border-line p-4 bg-paper-raised">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-lg">PLUS</h3>
                  <p className="text-[11px] text-ink-soft uppercase tracking-wider font-semibold">
                    Coming soon
                  </p>
                </div>
                <p className="text-sm font-bold mono text-debt">Coming Soon</p>
              </div>
              <p className="text-xs text-ink-soft mb-4">
                AI reminders, premium templates, voice entry, PDF receipts and additional business tools.
              </p>
              <div className="text-center py-2 px-4 rounded-lg border border-line text-ink-soft text-[11px] font-bold">
                NOT YET AVAILABLE
              </div>
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

          <div className="space-y-4">
            <button
              onClick={restore}
              disabled={restoring}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg py-3 text-[13px] font-semibold text-ink-soft border border-line bg-paper-raised disabled:opacity-50"
            >
              <RotateCcw size={13} /> {restoring ? "Restoring…" : "Restore Purchase"}
            </button>

            <p className="text-[10px] text-ink-soft text-center leading-relaxed px-4">
              Paid plans are not available yet. Track Debt will announce billing when checkout and
              server-side verification are ready. No payment is taken from this screen.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
