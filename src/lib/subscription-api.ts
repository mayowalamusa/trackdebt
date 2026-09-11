import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type ServerEntitlement = {
  plan: "free" | "plus";
  status: "free" | "active" | "cancelled" | "failed" | "expired";
  currentPeriodEnd: string | null;
  nextPaymentAt: string | null;
  cancelledAt: string | null;
};

export const freeEntitlement: ServerEntitlement = {
  plan: "free",
  status: "free",
  currentPeriodEnd: null,
  nextPaymentAt: null,
  cancelledAt: null,
};

export async function currentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function authorizedFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await currentSession();
  if (!session) throw new Error("Sign in required.");
  return fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${session.access_token}` },
  });
}

export async function fetchServerEntitlement(): Promise<ServerEntitlement> {
  if (!supabase) return freeEntitlement;
  const response = await authorizedFetch("/api/paystack/status");
  if (!response.ok) throw new Error("Could not load subscription status.");
  const result = (await response.json()) as { ok?: boolean; entitlement?: ServerEntitlement };
  return result.ok && result.entitlement ? result.entitlement : freeEntitlement;
}

export async function startPlusCheckout(): Promise<{ authorization_url: string }> {
  const response = await authorizedFetch("/api/paystack/initialize", { method: "POST" });
  const result = (await response.json()) as { ok?: boolean; authorization_url?: string; error?: string };
  if (!response.ok || !result.ok || !result.authorization_url) throw new Error(result.error ?? "Checkout could not be started.");
  return { authorization_url: result.authorization_url };
}

export async function cancelPlusSubscription(): Promise<void> {
  const response = await authorizedFetch("/api/paystack/cancel", { method: "POST" });
  const result = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || !result.ok) throw new Error(result.error ?? "Cancellation failed.");
}