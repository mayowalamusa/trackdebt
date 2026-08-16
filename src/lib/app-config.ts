/** Centralized product configuration: pricing, plans and ad units.
 *  Change values here only — never hard-code pricing or ad ids in components. */

export type PlanId = "free" | "plus" | "premium";

export const PRICING = {
  currency: "NGN",
  currencySymbol: "₦",
  plus: { amount: 1000, label: "₦1,000", period: "per month" },
  premium: { label: "Coming Soon" },
} as const;

export const PLUS_BENEFITS = [
  { icon: "ban", title: "No Ads", detail: "A clean, distraction-free ledger." },
  {
    icon: "sparkles",
    title: "AI & Premium Templates",
    detail: "AI-generated reminders and professional templates.",
  },
  { icon: "mic", title: "Voice Entry", detail: "Record debts and customers with your voice." },
  { icon: "file-text", title: "PDF Receipts", detail: "Generate professional receipts for your customers." },
  { icon: "message-circle", title: "WhatsApp Tools", detail: "Integrated WhatsApp reminder functionality." },
  { icon: "shield-check", title: "Priority Support", detail: "Faster response times for your business." },
] as const;

export const PREMIUM_BENEFITS = [
  { icon: "zap", title: "Everything in Plus", detail: "All Plus features included." },
  { icon: "message-square", title: "WhatsApp Receipts", detail: "Send receipts directly via WhatsApp API." },
  { icon: "clock", title: "Automated Reminders", detail: "Smart scheduling and automated follow-ups." },
  { icon: "users", title: "Bulk Messaging", detail: "Message multiple debtors at once." },
  { icon: "bar-chart", title: "Advanced Analytics", detail: "Deep business intelligence and reports." },
] as const;

export const COMPARISON: { feature: string; free: boolean; plus: boolean; premium: boolean }[] = [
  { feature: "Customer management", free: true, plus: true, premium: true },
  { feature: "Debt tracking", free: true, plus: true, premium: true },
  { feature: "Due-date notifications", free: true, plus: true, premium: true },
  { feature: "Promo code redemption", free: true, plus: true, premium: true },
  { feature: "WhatsApp sharing", free: true, plus: true, premium: true },
  { feature: "AI reminder generation", free: false, plus: true, premium: true },
  { feature: "Premium templates", free: false, plus: true, premium: true },
  { feature: "Voice entry", free: false, plus: true, premium: true },
  { feature: "PDF receipts", free: false, plus: true, premium: true },
  { feature: "No ads", free: false, plus: true, premium: true },
  { feature: "WhatsApp automation", free: false, plus: false, premium: true },
  { feature: "Advanced analytics", free: false, plus: false, premium: true },
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
export const DEVELOPER = "Izick Creations Media";
