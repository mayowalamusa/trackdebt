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
    if (!res.ok) {
      return { ok: false, error: "Could not check that code. Please try again." };
    }
    return (await res.json()) as RedeemPromoResult;
  } catch {
    return { ok: false, error: "You need an internet connection to redeem a promo code." };
  }
}
