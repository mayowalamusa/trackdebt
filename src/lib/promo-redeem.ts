// Browser-side promo redemption.
//
// Deliberately contains no codes and no validation rules — it only forwards the
// user's input to the server, which owns the code table and signs the resulting
// entitlement.

export type RedeemPromoResult =
  | { ok: true; plan: "plus" | "premium"; code: string; expiresAt: string; token: string }
  | { ok: false; error: string };

export async function redeemPromoCode(code: string): Promise<RedeemPromoResult> {
  try {
    const res = await fetch("/api/public/promo-redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const result = (await res.json().catch(() => null)) as RedeemPromoResult | null;
    if (result && typeof result === "object" && "ok" in result) {
      return result;
    }
    if (!res.ok) {
      return { ok: false, error: "Could not check that code. Please try again." };
    }
    return { ok: false, error: "The server returned an unexpected response. Please try again." };
  } catch {
    return { ok: false, error: "You need an internet connection to redeem a promo code." };
  }
}
