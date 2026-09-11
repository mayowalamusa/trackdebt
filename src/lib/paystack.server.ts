import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PLUS_AMOUNT_KOBO = 100_000;
export const PLUS_CURRENCY = "NGN";

export type PaystackData = {
  id?: number;
  reference?: string;
  amount?: number;
  currency?: string;
  status?: string;
  paid_at?: string | null;
  transaction_date?: string | null;
  customer?: { customer_code?: string; email?: string } | null;
  subscription?: { subscription_code?: string; next_payment_date?: string | null } | null;
  subscription_code?: string;
  email_token?: string;
  next_payment_date?: string | null;
  customer_code?: string;
  plan?: { plan_code?: string; amount?: number; interval?: string } | null;
  metadata?: { user_id?: string } | string | null;
  authorization?: Record<string, unknown> | null;
};

export type PaystackEvent = { event?: string; data?: PaystackData };

export function paystackSecret(): string | null {
  return process.env["PAYSTACK_SECRET_KEY"] ?? null;
}

export function verifyPaystackSignature(rawBody: string, signature: string | null): boolean {
  const secret = paystackSecret();
  if (!secret || !signature) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const actual = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export function metadataUserId(data: PaystackData): string | null {
  if (!data.metadata || typeof data.metadata === "string") return null;
  return typeof data.metadata.user_id === "string" ? data.metadata.user_id : null;
}

export const customerCode = (data: PaystackData) => data.customer?.customer_code ?? data.customer_code ?? null;
export const subscriptionCode = (data: PaystackData) => data.subscription?.subscription_code ?? data.subscription_code ?? null;
export const nextPaymentDate = (data: PaystackData) => data.subscription?.next_payment_date ?? data.next_payment_date ?? null;

export function isValidPlusCharge(data: PaystackData): boolean {
  return (
    data.status === "success" &&
    data.amount === PLUS_AMOUNT_KOBO &&
    data.currency === PLUS_CURRENCY
  );
}

export function periodEnd(data: PaystackData, fallback?: string | null): string | null {
  return nextPaymentDate(data) ?? fallback ?? null;
}

export async function initializePlusCheckout(input: {
  email: string;
  userId: string;
  callbackUrl: string;
}) {
  const secret = paystackSecret();
  const plan = process.env["PAYSTACK_PLUS_PLAN_CODE"];
  if (!secret || !plan) throw new Error("Paystack server configuration is incomplete.");

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      amount: PLUS_AMOUNT_KOBO,
      currency: PLUS_CURRENCY,
      plan,
      callback_url: input.callbackUrl,
      metadata: { user_id: input.userId, product: "trackdebt_plus" },
    }),
  });
  const result = (await response.json()) as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string; access_code?: string; reference?: string };
  };
  if (!response.ok || !result.status || !result.data?.authorization_url || !result.data.reference) {
    throw new Error(result.message ?? "Paystack checkout could not be started.");
  }
  return result.data;
}

export async function disablePaystackSubscription(subscriptionCode: string, emailToken: string) {
  const secret = paystackSecret();
  if (!secret) throw new Error("Paystack server configuration is incomplete.");
  const response = await fetch("https://api.paystack.co/subscription/disable", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ code: subscriptionCode, token: emailToken }),
  });
  const result = (await response.json()) as { status?: boolean; message?: string };
  if (!response.ok || !result.status) throw new Error(result.message ?? "Cancellation failed.");
}

export async function findSubscriptionByCustomer(
  admin: SupabaseClient,
  customerCode: string,
): Promise<{ user_id: string; current_period_end: string | null } | null> {
  const { data } = await admin
    .from("subscriptions")
    .select("user_id,current_period_end")
    .eq("paystack_customer_code", customerCode)
    .maybeSingle();
  return data;
}