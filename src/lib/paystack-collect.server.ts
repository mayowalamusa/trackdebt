import type { SupabaseClient, User } from "@supabase/supabase-js";
import { paystackSecret } from "./paystack.server";
import { getEntitlement } from "./subscription.server";
import { createSupabaseAdmin, userFromRequest } from "./supabase.server";

/** Track Debt's share of each customer payment, in percent. */
export function platformFeePercent(): number {
  const raw = Number(process.env["PAYSTACK_PLATFORM_FEE_PERCENT"] ?? "1");
  return Number.isFinite(raw) && raw >= 0 && raw < 50 ? raw : 1;
}

export async function paystackApi<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const secret = paystackSecret();
  if (!secret) throw new Error("Paystack is not configured.");
  const response = await fetch(`https://api.paystack.co${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const result = (await response.json()) as { status?: boolean; message?: string; data?: T };
  if (!response.ok || !result.status) throw new Error(result.message ?? "Paystack request failed.");
  return result.data as T;
}

/** Signed-in Plus user + admin client, or an error Response. */
export async function requirePlusUser(
  request: Request,
): Promise<{ user: User; admin: SupabaseClient } | Response> {
  const user = await userFromRequest(request);
  if (!user) return Response.json({ ok: false, error: "Sign in required." }, { status: 401 });
  const admin = createSupabaseAdmin();
  if (!admin) return Response.json({ ok: false, error: "Payments are not configured." }, { status: 503 });
  const entitlement = await getEntitlement(admin, user.id);
  if (entitlement.plan !== "plus") {
    return Response.json({ ok: false, error: "Collecting payments is a Plus feature." }, { status: 403 });
  }
  return { user, admin };
}
