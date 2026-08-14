import { ArrowLeft, ChevronRight, Crown, WifiOff, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { showAds, type Subscription } from "@/lib/subscription";
import { canShowAdIn, isNativePlatform, type AdSlot } from "@/lib/ads";
import type { DueInfo } from "@/lib/due-dates";

/* ---------------- layout ---------------- */

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-paper relative pb-28 shadow-sm">
        <OfflineIndicator />
        {children}
      </div>
    </main>
  );
}

export function OfflineIndicator() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-ink px-4 py-1.5 text-[12px] font-semibold text-paper-raised"
    >
      <WifiOff size={13} aria-hidden="true" /> Offline — your ledger still works
    </div>
  );
}

/* ---------------- primitives ---------------- */

export function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "debt" | "paid" | "warn" | undefined;
}) {
  return (
    <div className="rounded border border-line bg-paper px-3 py-2.5">
      <p className="text-[11px] tracking-wide text-ink-soft flex items-center gap-1.5">
        <span aria-hidden="true">{icon}</span> {label}
      </p>
      <p
        className={`mono text-[16px] font-bold mt-1 ${
          tone === "debt"
            ? "text-debt"
            : tone === "paid"
              ? "text-paid"
              : tone === "warn"
                ? "text-warn"
                : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3.5 min-h-11 text-[13px] font-semibold border transition-colors ${
        active ? "bg-ink text-paper-raised border-ink" : "bg-paper-raised text-ink-soft border-line"
      }`}
    >
      {label}
    </button>
  );
}

export function Field({
  label,
  children,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="mb-4">
      <label
        htmlFor={htmlFor ?? ""}
        className="mono text-[12px] tracking-widest text-ink-soft block mb-1.5"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function ScreenHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 pt-4 pb-7">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="h-11 w-11 -ml-2 grid place-items-center rounded text-ink"
      >
        <X size={20} aria-hidden="true" />
      </button>
      <h2 className="font-semibold text-lg truncate">{title}</h2>
    </div>
  );
}

export function PageHeader({ title, backTo }: { title: string; backTo: string }) {
  return (
    <header className="flex items-center gap-2 px-3 pt-6 pb-5 border-b border-line bg-paper-raised">
      <a
        href={backTo}
        aria-label="Go back"
        className="h-11 w-11 grid place-items-center rounded text-ink"
      >
        <ArrowLeft size={20} aria-hidden="true" />
      </a>
      <h1 className="font-semibold text-lg truncate">{title}</h1>
    </header>
  );
}

/* ---------------- due-date badge ---------------- */

export function DueBadge({ info, className = "" }: { info: DueInfo; className?: string }) {
  if (info.status === "settled") return null;
  const tone =
    info.tone === "debt"
      ? "border-debt text-debt"
      : info.tone === "warn"
        ? "border-warn text-warn"
        : info.tone === "paid"
          ? "border-paid text-paid"
          : "border-line text-ink-soft";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${tone} ${className}`}
    >
      {info.label}
    </span>
  );
}

export function SettingsRow({
  icon,
  label,
  value,
  onClick,
  href,
  tone,
  external,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  href?: string;
  tone?: "debt" | "paid" | undefined;
  external?: boolean;
}) {
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 text-ink-soft" aria-hidden="true">
          {icon}
        </span>
        <span className="truncate text-sm font-medium">{label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {value && (
          <span
            className={`text-[12px] font-semibold ${
              tone === "debt" ? "text-debt" : tone === "paid" ? "text-paid" : "text-ink-soft"
            }`}
          >
            {value}
          </span>
        )}
        <ChevronRight size={16} className="text-ink-soft" aria-hidden="true" />
      </span>
    </>
  );
  const className =
    "ledger-row w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors active:bg-muted";
  if (href) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className={className}
      >
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

/* ---------------- first-time tips ---------------- */

export function TipCallout({
  children,
  onDismiss,
  className = "",
}: {
  children: ReactNode;
  onDismiss: () => void;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`z-40 max-w-[260px] rounded-lg border border-ink bg-ink px-3.5 py-3 text-[12.5px] leading-snug text-paper-raised shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 ${className}`}
    >
      <div className="flex items-start gap-2">
        <p className="flex-1">{children}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss tip"
          className="-mr-0.5 -mt-0.5 h-6 w-6 shrink-0 grid place-items-center rounded text-paper-raised/70"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- premium ---------------- */

export function ProBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-paper-raised ${className}`}
    >
      <Crown size={10} aria-hidden="true" /> Pro
    </span>
  );
}

export function PremiumGate({
  title,
  description,
  onClose,
}: {
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4"
    >
      <div className="w-full max-w-[398px] rounded-lg border border-line bg-paper-raised p-5 animate-in slide-in-from-bottom-4 duration-200">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
          <Crown size={13} aria-hidden="true" /> Track Debt Pro feature
        </p>
        <h3 className="mt-2 text-lg font-semibold">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{description}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded border border-line bg-paper text-sm font-semibold"
          >
            Maybe later
          </button>
          <Link
            to="/upgrade"
            className="btn-primary min-h-11 rounded grid place-items-center text-sm font-semibold"
          >
            Upgrade to Pro
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------------- ads ----------------
 * Track Debt ships to Android through Capacitor, where AdMob is a native SDK.
 * On the web there is no ad surface, so these render nothing at all. */

export function AdPlacement({
  slot,
  context,
  subscription,
}: {
  slot: AdSlot;
  context: string;
  subscription: Subscription;
}) {
  const eligible = showAds(subscription) && canShowAdIn(context) && isNativePlatform();
  if (!eligible) return null;
  // The native AdMob view is attached by the Capacitor plugin; this element is
  // only the layout anchor so content is never covered.
  return <div data-ad-slot={slot} aria-hidden="true" className="h-14 w-full" />;
}
