import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Ban,
  Check,
  Cloud,
  FileSpreadsheet,
  Minus,
  RotateCcw,
  Sparkles,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/ledger";
import { COMPARISON, PRICING, PRO_BENEFITS } from "@/lib/app-config";
import { isPro, paymentService } from "@/lib/subscription";
import { useSubscription } from "@/lib/use-ledger-storage";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/upgrade")({
  head: () => ({
    meta: [
      { title: `Track Debt Pro — ${APP_NAME}` },
      {
        name: "description",
        content: "Remove ads, unlock premium reminder templates, exports and more.",
      },
    ],
  }),
  component: UpgradePage,
});

const BENEFIT_ICONS: Record<string, typeof Ban> = {
  ban: Ban,
  sparkles: Sparkles,
  sheet: FileSpreadsheet,
  cloud: Cloud,
  store: Store,
  chart: BarChart3,
};

function UpgradePage() {
  const [sub, setSub] = useSubscription();
  const [plan, setPlan] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    track("upgrade_page_viewed");
  }, []);

  const subscribe = async () => {
    setLoading(true);
    track("upgrade_initiated", { plan });
    try {
      const intent = await paymentService.startCheckout(plan);
      const result = await paymentService.verify(intent.reference);
      setSub(result);
      toast(
        "Billing isn't connected yet — this is a preview of the upgrade flow. Your plan stays Free for now.",
      );
    } catch {
      toast.error("Something went wrong starting checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const restore = async () => {
    setRestoring(true);
    try {
      const restored = await paymentService.restore();
      setSub(restored);
      toast(
        restored.state === "pro_active"
          ? "Track Debt Pro restored."
          : "No active purchase found on this device.",
      );
    } catch {
      toast.error("Could not restore purchase. Please try again.");
    } finally {
      setRestoring(false);
    }
  };

  const price = PRICING[plan];

  return (
    <main className="min-h-dvh bg-background flex justify-center">
      <div className="w-full max-w-[430px] min-h-dvh bg-paper relative pb-16">
        <header className="flex items-center gap-2 px-3 pt-6 pb-5 border-b border-line bg-paper-raised">
          <Link
            to="/"
            aria-label="Back"
            className="h-11 w-11 grid place-items-center rounded text-ink"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
          <h1 className="font-semibold text-lg truncate">Track Debt Pro</h1>
        </header>

        <div className="p-5">
          <div className="text-center mb-7 mt-2">
            <h2 className="text-2xl font-bold">Track Debt Pro</h2>
            <p className="mt-1.5 text-sm font-medium text-ink-soft">
              Get more from your business credit management.
            </p>
          </div>

          {isPro(sub) ? (
            <div className="rounded-lg border border-paid bg-paid/10 px-4 py-5 text-center mb-6">
              <p className="text-sm font-semibold text-paid">You&rsquo;re on Track Debt Pro</p>
              <p className="text-[12px] text-ink-soft mt-1">
                Thanks for supporting {APP_NAME}. All premium features are unlocked.
              </p>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setPlan("monthly")}
                  className={`flex-1 rounded-lg border px-3 py-3 text-left transition-colors ${
                    plan === "monthly" ? "border-ink bg-paper-raised" : "border-line bg-paper"
                  }`}
                >
                  <p className="text-[11px] font-semibold text-ink-soft">MONTHLY</p>
                  <p className="mono text-lg font-bold mt-0.5">{PRICING.monthly.label}</p>
                  <p className="text-[11px] text-ink-soft">{PRICING.monthly.period}</p>
                </button>
                <button
                  onClick={() => setPlan("yearly")}
                  className={`flex-1 rounded-lg border px-3 py-3 text-left transition-colors relative ${
                    plan === "yearly" ? "border-ink bg-paper-raised" : "border-line bg-paper"
                  }`}
                >
                  <span className="absolute -top-2 right-2 rounded-full bg-debt px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-paper-raised">
                    {PRICING.yearly.savingsLabel}
                  </span>
                  <p className="text-[11px] font-semibold text-ink-soft">YEARLY</p>
                  <p className="mono text-lg font-bold mt-0.5">{PRICING.yearly.label}</p>
                  <p className="text-[11px] text-ink-soft">{PRICING.yearly.period}</p>
                </button>
              </div>

              <button
                onClick={subscribe}
                disabled={loading}
                className="btn-primary w-full rounded py-3.5 text-sm font-semibold mb-2 disabled:opacity-50 transition-transform active:scale-[0.99]"
              >
                {loading ? "Starting checkout…" : `Upgrade to Pro — ${price.label} ${price.period}`}
              </button>
              <button
                onClick={restore}
                disabled={restoring}
                className="w-full flex items-center justify-center gap-1.5 rounded py-2.5 text-[13px] font-semibold text-ink-soft disabled:opacity-50"
              >
                <RotateCcw size={13} /> {restoring ? "Restoring…" : "Restore Purchase"}
              </button>
            </>
          )}

          <div className="space-y-3.5 my-7">
            {PRO_BENEFITS.map((b) => {
              const Icon = BENEFIT_ICONS[b.icon] ?? Sparkles;
              return (
                <div key={b.title} className="flex items-start gap-3">
                  <span className="h-8 w-8 shrink-0 rounded-full bg-debt/10 text-debt grid place-items-center">
                    <Icon size={15} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{b.title}</p>
                    <p className="text-[12px] text-ink-soft">{b.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mono text-[11px] tracking-widest text-ink-soft mb-2">FREE VS PRO</p>
          <div className="rounded-lg border border-line overflow-hidden mb-6">
            <div className="grid grid-cols-[1fr,56px,56px] bg-paper-raised text-[11px] font-semibold text-ink-soft px-3 py-2">
              <span>Feature</span>
              <span className="text-center">Free</span>
              <span className="text-center">Pro</span>
            </div>
            {COMPARISON.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-[1fr,56px,56px] items-center px-3 py-2.5 text-[12.5px] ${
                  i % 2 === 1 ? "bg-paper-raised/50" : ""
                }`}
              >
                <span className="pr-2">{row.feature}</span>
                <span className="flex justify-center">
                  {row.free ? (
                    <Check size={14} className="text-paid" />
                  ) : (
                    <Minus size={14} className="text-ink-soft/50" />
                  )}
                </span>
                <span className="flex justify-center">
                  {row.pro ? (
                    <Check size={14} className="text-paid" />
                  ) : (
                    <Minus size={14} className="text-ink-soft/50" />
                  )}
                </span>
              </div>
            ))}
            <div className="grid grid-cols-[1fr,56px,56px] items-center px-3 py-2.5 text-[12.5px] bg-paper-raised/50">
              <span className="pr-2">Ads</span>
              <span className="flex justify-center text-[11px] font-semibold text-ink-soft">
                Yes
              </span>
              <span className="flex justify-center text-[11px] font-semibold text-paid">No</span>
            </div>
          </div>

          <p className="text-[11px] text-ink-soft text-center leading-relaxed">
            Billing is not live yet — this page previews the upgrade experience. No payment will be
            taken.
          </p>
        </div>
      </div>
    </main>
  );
}
