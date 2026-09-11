import type { SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionStatus = "free" | "active" | "cancelled" | "failed" | "expired";

export type StoredSubscription = {
  user_id: string;
  plan: "free" | "plus";
  status: SubscriptionStatus;
  paystack_customer_code: string | null;
  paystack_subscription_code: string | null;
  paystack_email_token: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancellation_at: string | null;
  last_successful_payment_at: string | null;
  next_expected_payment_at: string | null;
  last_transaction_reference: string | null;
  amount: number | null;
  currency: string | null;
};

export type Entitlement = {
  plan: "free" | "plus";
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  nextPaymentAt: string | null;
  cancelledAt: string | null;
};

export function isPlusEntitled(subscription: Pick<StoredSubscription, "plan" | "status" | "current_period_end"> | null, now = Date.now()): boolean {
  if (!subscription || subscription.plan !== "plus") return false;
  if (!subscription.current_period_end) return false;
  const periodEnd = Date.parse(subscription.current_period_end);
  if (!Number.isFinite(periodEnd) || periodEnd <= now) return false;
  return subscription.status === "active" || subscription.status === "cancelled" || subscription.status === "failed";
}

export function entitlementFromSubscription(subscription: StoredSubscription | null, now = Date.now()): Entitlement {
  const active = isPlusEntitled(subscription, now);
  return {
    plan: active ? "plus" : "free",
    status: subscription?.status ?? "free",
    currentPeriodEnd: subscription?.current_period_end ?? null,
    nextPaymentAt: subscription?.next_expected_payment_at ?? null,
    cancelledAt: subscription?.cancellation_at ?? null,
  };
}

export async function getSubscription(admin: SupabaseClient, userId: string): Promise<StoredSubscription | null> {
  const { data, error } = await admin
    .from("subscriptions")
    .select(
      "user_id,plan,status,paystack_customer_code,paystack_subscription_code,paystack_email_token,current_period_start,current_period_end,cancellation_at,last_successful_payment_at,next_expected_payment_at,last_transaction_reference,amount,currency",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getEntitlement(admin: SupabaseClient, userId: string): Promise<Entitlement> {
  return entitlementFromSubscription(await getSubscription(admin, userId));
}

export function webhookEventKey(event: string, data: { id?: number; reference?: string; subscription_code?: string; subscription?: { subscription_code?: string } | null }): string | null {
  const identifier = data.id ?? data.reference ?? data.subscription_code ?? data.subscription?.subscription_code;
  return identifier == null ? null : `${event}:${identifier}`;
}