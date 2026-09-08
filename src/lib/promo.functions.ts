import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  code: z.string().min(1).max(64),
});

export type RedeemPromoResult =
  | { ok: true; plan: "plus" | "premium"; code: string; expiresAt: string; token: string }
  | { ok: false; error: string };

/**
 * Validates a promo code on the server. Neither the code table nor the
 * validation logic reaches the browser bundle, and the returned entitlement is
 * signed so privileged server endpoints can re-verify it independently.
 */
export const redeemPromoCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<RedeemPromoResult> => {
    const [{ findPromo }, { issueEntitlementToken }] = await Promise.all([
      import("./promo.server"),
      import("./entitlement.server"),
    ]);

    const promo = findPromo(data.code);
    if (!promo) {
      return { ok: false, error: "Invalid promo code. Please check and try again." };
    }

    const expiresAt = new Date(Date.now() + promo.days * 86_400_000).toISOString();
    const token = await issueEntitlementToken({
      plan: promo.plan,
      exp: new Date(expiresAt).getTime(),
      ref: `promo:${promo.code}`,
    });

    if (!token) {
      return { ok: false, error: "Promo codes are not available right now. Please try again later." };
    }

    return { ok: true, plan: promo.plan, code: promo.code, expiresAt, token };
  });
