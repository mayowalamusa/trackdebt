/** Centralized product configuration: pricing, plans and ad units.
 *  Change values here only — never hard-code pricing or ad ids in components. */

export type PlanId = "free" | "pro";

export const PRICING = {
  currency: "NGN",
  currencySymbol: "₦",
  monthly: { amount: 1500, label: "₦1,500", period: "per month" },
  yearly: { amount: 15000, label: "₦15,000", period: "per year", savingsLabel: "Save 2 months" },
  trialDays: 0,
} as const;

export const PRO_BENEFITS = [
  { icon: "ban", title: "No Ads", detail: "A clean, distraction-free ledger." },
  {
    icon: "sparkles",
    title: "Premium Reminder Templates",
    detail: "Professional, Firm, Final, VIP and more.",
  },
  { icon: "sheet", title: "Excel & CSV Export", detail: "Take your records anywhere." },
  { icon: "cloud", title: "Cloud Backup", detail: "Never lose your ledger with a lost phone." },
  { icon: "store", title: "Multiple Businesses", detail: "Run more than one shop from one app." },
  { icon: "chart", title: "Advanced Business Insights", detail: "See trends, risk and forecasts." },
] as const;

export const COMPARISON: { feature: string; free: boolean; pro: boolean }[] = [
  { feature: "Customer management", free: true, pro: true },
  { feature: "Debt tracking", free: true, pro: true },
  { feature: "Payment terms & due dates", free: true, pro: true },
  { feature: "WhatsApp reminders", free: true, pro: true },
  { feature: "AI reminder", free: true, pro: true },
  { feature: "Basic receipts & statements", free: true, pro: true },
  { feature: "Premium templates", free: false, pro: true },
  { feature: "Excel export", free: false, pro: true },
  { feature: "CSV export", free: false, pro: true },
  { feature: "Cloud backup", free: false, pro: true },
  { feature: "Multiple businesses", free: false, pro: true },
];

/** Google AdMob configuration. Real production ids are injected later via
 *  environment configuration — the Google test ids are used in development. */
export const ADMOB = {
  testMode: import.meta.env.MODE !== "production",
  appId: import.meta.env["VITE_ADMOB_APP_ID"] ?? "ca-app-pub-3940256099942544~3347511713",
  banner: {
    test: "ca-app-pub-3940256099942544/6300978111",
    production: import.meta.env["VITE_ADMOB_BANNER_ID"] ?? "",
  },
  native: {
    test: "ca-app-pub-3940256099942544/2247696110",
    production: import.meta.env["VITE_ADMOB_NATIVE_ID"] ?? "",
  },
} as const;

export const SUPPORT_EMAIL = "support@trackdebt.app";
export const WEBSITE_URL = "https://trackdebt.lovable.app";
export const DEVELOPER = "Track Debt Labs";
