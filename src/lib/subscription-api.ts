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
  if (response.status === 401 || response.status === 503) return freeEntitlement;
  if (!response.ok) throw new Error("Could not load subscription status.");
  const result = (await response.json()) as { ok?: boolean; entitlement?: ServerEntitlement };
  return result.ok && result.entitlement ? result.entitlement : freeEntitlement;
}

export async function startPlusCheckout(): Promise<{ authorization_url: string }> {
  const response = await authorizedFetch("/api/paystack/initialize", { method: "POST" });
  const result = (await response.json()) as {
    ok?: boolean;
    authorization_url?: string;
    error?: string;
  };
  if (!response.ok || !result.ok || !result.authorization_url)
    throw new Error(result.error ?? "Checkout could not be started.");
  return { authorization_url: result.authorization_url };
}

export async function cancelPlusSubscription(): Promise<void> {
  const response = await authorizedFetch("/api/paystack/cancel", { method: "POST" });
  const result = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || !result.ok) throw new Error(result.error ?? "Cancellation failed.");
}

export async function fetchAccountStatus(): Promise<{
  status: "active" | "deletion_pending" | "deleted";
  restorableUntil: string | null;
}> {
  const response = await authorizedFetch("/api/account/status");
  const result = (await response.json()) as {
    ok?: boolean;
    status?: "active" | "deletion_pending" | "deleted";
    restorableUntil?: string | null;
    error?: string;
  };
  if (!response.ok || !result.ok || !result.status)
    throw new Error(result.error ?? "Could not load account status.");
  return { status: result.status, restorableUntil: result.restorableUntil ?? null };
}

export async function deleteAccount(): Promise<void> {
  const response = await authorizedFetch("/api/account/delete", { method: "POST" });
  const result = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || !result.ok)
    throw new Error(result.error ?? "Could not start account deletion.");
}

export async function restoreAccount(): Promise<void> {
  const response = await authorizedFetch("/api/account/restore", { method: "POST" });
  const result = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not restore the account.");
}
/** Links a locally stored, server-signed promo token to the signed-in account (best effort). */
export async function claimStoredPromoEntitlement(): Promise<void> {
  if (!supabase) return;
  let token: unknown;
  try {
    const raw = window.localStorage.getItem("trackdebt.v3.promo");
    const promo = raw ? (JSON.parse(raw) as { token?: unknown; expiresAt?: string } | null) : null;
    if (!promo?.token || !promo.expiresAt || Date.parse(promo.expiresAt) <= Date.now()) return;
    token = promo.token;
  } catch {
    return;
  }
  try {
    await authorizedFetch("/api/promo/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    /* non-fatal: retried on next sign-in */
  }
}
