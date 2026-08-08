import type { PlanId } from "./app-config";

export type SubscriptionState =
  | "free"
  | "pro_active"
  | "pro_expired"
  | "payment_pending"
  | "payment_failed";

export type Subscription = {
  state: SubscriptionState;
  /** ISO timestamp; only meaningful for pro states. */
  expiresAt?: string;
  /** Which billing provider activated the plan, when known. */
  provider?: "google_play" | "paystack" | "manual";
  lastError?: string;
};

export const freeSubscription: Subscription = { state: "free" };

/** Resolve the effective plan, taking expiry into account.
 *  A Pro plan whose expiry has passed silently falls back to Free —
 *  local data is never touched. */
export function resolvePlan(sub: Subscription): PlanId {
  if (sub.state !== "pro_active") return "free";
  if (sub.expiresAt && new Date(sub.expiresAt).getTime() < Date.now()) return "free";
  return "pro";
}

export function normalize(sub: Subscription): Subscription {
  if (sub.state === "pro_active" && sub.expiresAt && new Date(sub.expiresAt) < new Date()) {
    return { ...sub, state: "pro_expired" };
  }
  return sub;
}

export const isPro = (sub: Subscription) => resolvePlan(sub) === "pro";
export const showAds = (sub: Subscription) => !isPro(sub);

export const stateLabel = (sub: Subscription) => {
  switch (normalize(sub).state) {
    case "pro_active":
      return "Track Debt Pro";
    case "pro_expired":
      return "Track Debt Pro (expired)";
    case "payment_pending":
      return "Payment pending";
    case "payment_failed":
      return "Payment failed";
    default:
      return "Track Debt Free";
  }
};

/* ---------------- payment service abstraction ----------------
 * The frontend NEVER decides that a payment succeeded. These methods describe
 * the contract that a backend (Google Play Billing or Paystack verification)
 * will fulfil later; today they only move the local UI state. */

export type PaymentIntent = { reference: string; plan: "monthly" | "yearly" };

export interface PaymentService {
  /** Start a checkout. Returns a reference the backend can verify. */
  startCheckout(plan: "monthly" | "yearly"): Promise<PaymentIntent>;
  /** Server-side verification. Only the backend may confirm activation. */
  verify(reference: string): Promise<Subscription>;
  /** Re-read an existing entitlement (app-store restore purchase). */
  restore(): Promise<Subscription>;
}

/** Placeholder implementation used until a billing backend is connected. */
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
