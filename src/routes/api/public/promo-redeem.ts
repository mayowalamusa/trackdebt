import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { findPromo } from "@/lib/promo.server";
import { issueEntitlementToken } from "@/lib/entitlement.server";
import { createSupabaseAdmin } from "@/lib/supabase.server";

const InputSchema = z.object({ code: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/) });

type DbPromo = {
  id: string;
  code: string;
  plan: "plus" | "premium";
  days: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
};

const INVALID = { ok: false, error: "Invalid promo code. Please check and try again." };

// Promo validation runs here, on the server: codes live in the database (managed
// from the admin panel) and never reach the browser bundle. The entitlement
// handed back is signed so privileged endpoints can re-verify it.
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
        const input = parsed.code.toUpperCase();
        const admin = createSupabaseAdmin();

        let plan: "plus" | "premium";
        let days: number;
        let code: string;
        let dbPromo: DbPromo | null = null;

        if (admin) {
          // Codes only contain [A-Za-z0-9_-]; escape "_" so ilike matches it literally.
          const { data, error } = await admin
            .from("promo_codes")
            .select("id,code,plan,days,max_uses,uses_count,expires_at,is_active")
            .ilike("code", input.replace(/_/g, "\\_"))
            .maybeSingle();
          if (error) {
            console.error("promo lookup failed", error.message);
            return Response.json({ ok: false, error: "Could not check that code. Please try again." });
          }
          dbPromo = (data as DbPromo | null) ?? null;
        }

        if (dbPromo) {
          if (!dbPromo.is_active) return Response.json({ ok: false, error: "This promo code is no longer active." });
          if (dbPromo.expires_at && Date.parse(dbPromo.expires_at) <= Date.now()) {
            return Response.json({ ok: false, error: "This promo code has expired." });
          }
          if (dbPromo.max_uses != null && dbPromo.uses_count >= dbPromo.max_uses) {
            return Response.json({ ok: false, error: "This promo code has reached its usage limit." });
          }
          // Optimistic concurrency: only count the use if nobody else redeemed in between.
          const { data: updated, error: updateError } = await admin!
            .from("promo_codes")
            .update({ uses_count: dbPromo.uses_count + 1 })
            .eq("id", dbPromo.id)
            .eq("uses_count", dbPromo.uses_count)
            .select("id");
          if (updateError || !updated?.length) {
            return Response.json({ ok: false, error: "Could not redeem that code right now. Please try again." });
          }
          plan = dbPromo.plan;
          days = dbPromo.days;
          code = dbPromo.code.toUpperCase();
        } else {
          const fallback = findPromo(input);
          if (!fallback) return Response.json(INVALID);
          plan = fallback.plan;
          days = fallback.days;
          code = fallback.code;
        }

        const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
        const tokenRef = `promo:${code}:${crypto.randomUUID()}`;
        const token = await issueEntitlementToken({ plan, exp: new Date(expiresAt).getTime(), ref: tokenRef });

        if (!token) {
          return Response.json({ ok: false, error: "Promo codes are unavailable right now. Please try again later." });
        }

        if (admin) {
          const { error: logError } = await admin.from("promo_redemptions").insert({
            promo_code_id: dbPromo?.id ?? null,
            token_ref: tokenRef,
            expires_at: expiresAt,
            metadata: { code, plan, days, source: dbPromo ? "database" : "fallback" },
          });
          if (logError) console.error("promo redemption log failed", logError.message);
        }

        return Response.json({ ok: true, plan, code, expiresAt, token });
      },
    },
  },
});
