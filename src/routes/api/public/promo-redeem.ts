import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { findPromo } from "@/lib/promo.server";
import { issueEntitlementToken } from "@/lib/entitlement.server";

const InputSchema = z.object({ code: z.string().min(1).max(64) });

// Promo validation runs here, on the server: the code table and the matching
// logic never reach the browser bundle, and the entitlement handed back is
// signed so privileged endpoints can re-verify it instead of trusting a flag
// the device owner can edit.
export const Route = createFileRoute("/api/public/promo-redeem")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = InputSchema.parse(await request.json());
        } catch {
          return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
        }

        const promo = findPromo(parsed.code);
        if (!promo) {
          return Response.json({
            ok: false,
            error: "Invalid promo code. Please check and try again.",
          });
        }

        const expiresAt = new Date(Date.now() + promo.days * 86_400_000).toISOString();
        const token = await issueEntitlementToken({
          plan: promo.plan,
          exp: new Date(expiresAt).getTime(),
          ref: `promo:${promo.code}`,
        });

        if (!token) {
          return Response.json({
            ok: false,
            error: "Promo codes are unavailable right now. Please try again later.",
          });
        }

        return Response.json({
          ok: true,
          plan: promo.plan,
          code: promo.code,
          expiresAt,
          token,
        });
      },
    },
  },
});
