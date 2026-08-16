import type { PlanId } from "./app-config";

export type SubscriptionState =
  | "free"
  | "plus_active"
  | "plus_expired"
  | "premium_active"
  | "premium_expired"
  | "payment_pending"
  | "payment_failed";

export type Subscription = {
  state: SubscriptionState;
  /** ISO timestamp; only meaningful for active states. */
  expiresAt?: string;
  /** Which billing provider activated the plan, when known. */
  provider?: "google_play" | "paystack" | "manual";
  lastError?: string;
};

export type PromoEntitlement = {
  plan: PlanId;
  expiresAt: string; // ISO
  code: string;
};

export const freeSubscription: Subscription = { state: "free" };

/** Resolve the effective plan, taking base subscription and promo entitlements into account. */
export function resolvePlan(sub: Subscription, promo?: PromoEntitlement | null): PlanId {
  const now = Date.now();

  // Check promo first as it might be higher tier
  if (promo && new Date(promo.expiresAt).getTime() > now) {
    // If base is premium and active, promo plus doesn't downgrade it.
    if (sub.state === "premium_active" && sub.expiresAt && new Date(sub.expiresAt).getTime() > now) {
      return "premium";
    }
    return promo.plan;
  }

  // Check base subscription
  if (sub.expiresAt && new Date(sub.expiresAt).getTime() > now) {
    if (sub.state === "premium_active") return "premium";
    if (sub.state === "plus_active") return "plus";
  }

  return "free";
}

export function normalize(sub: Subscription): Subscription {
  const now = new Date();
  if (sub.expiresAt && new Date(sub.expiresAt) < now) {
    if (sub.state === "plus_active") return { ...sub, state: "plus_expired" };
    if (sub.state === "premium_active") return { ...sub, state: "premium_expired" };
  }
  return sub;
}

export const planLabel = (plan: PlanId) => {
  switch (plan) {
    case "premium": return "Track Debt Premium";
    case "plus": return "Track Debt Plus";
    default: return "Track Debt Free";
  }
};

export const stateLabel = (sub: Subscription) => {
  const normalized = normalize(sub);
  switch (normalized.state) {
    case "premium_active": return "Track Debt Premium";
    case "premium_expired": return "Track Debt Premium (expired)";
    case "plus_active": return "Track Debt Plus";
    case "plus_expired": return "Track Debt Plus (expired)";
    case "payment_pending": return "Payment pending";
    case "payment_failed": return "Payment failed";
    default: return "Track Debt Free";
  }
};

export const isPro = (sub: Subscription) => sub.state === "plus_active" || sub.state === "premium_active";
export const showAds = (sub: Subscription) => !isPro(sub);

/** Centralized feature gating. */

export interface Entitlements {
  plan: PlanId;
  ads: boolean;
  aiReminders: boolean;
  voiceEntry: boolean;
  pdfReceipts: boolean;
  whatsappTools: boolean;
  premiumTemplates: boolean;
  automation: boolean; // Premium only
}

export function getEntitlements(plan: PlanId): Entitlements {
  return {
    plan,
    ads: plan === "free",
    aiReminders: plan !== "free",
    voiceEntry: plan !== "free",
    pdfReceipts: plan !== "free",
    whatsappTools: plan !== "free",
    premiumTemplates: plan !== "free",
    automation: plan === "premium",
  };
}

/* ---------------- payment service abstraction ---------------- */

export type PaymentIntent = { reference: string; plan: "plus" };

export interface PaymentService {
  startCheckout(plan: "plus"): Promise<PaymentIntent>;
  verify(reference: string): Promise<Subscription>;
  restore(): Promise<Subscription>;
}

export const paymentService: PaymentService = {
  async startCheckout(plan) {
    return { reference: `TD-CHECKOUT-${Date.now()}`, plan };
  },
  async verify() {
    return {
      state: "payment_pending",
      lastError: "Payment verification is not connected yet.",
    };
  },
  async restore() {
    return freeSubscription;
  },
};
