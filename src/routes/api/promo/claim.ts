import { createFileRoute } from "@tanstack/react-router";
import { verifyEntitlementToken } from "@/lib/entitlement.server";
import { createSupabaseAdmin, userFromRequest } from "@/lib/supabase.server";

// Links a signed promo entitlement to the signed-in account so server-side
// rules (e.g. the Free active-customer limit) recognise promo Plus/Premium.
// Only a valid, unexpired server-signed token can be claimed, and a token
// already claimed by another account is never reassigned.
export const Route = createFileRoute("/api/promo/claim")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await userFromRequest(request);
        if (!user) return Response.json({ ok: false, error: "Sign in required." }, { status: 401 });
        let body: unknown;
        try { body = await request.json(); } catch { return Response.json({ ok: false }, { status: 400 }); }
        const token = (body as { token?: unknown } | null)?.token;
        const claims = await verifyEntitlementToken(token);
        if (!claims) return Response.json({ ok: false, error: "Invalid or expired promo." }, { status: 400 });
        const admin = createSupabaseAdmin();
        if (!admin) return Response.json({ ok: false }, { status: 503 });
        const expiresAt = new Date(claims.exp).toISOString();
        const { data: existing, error } = await admin
          .from("promo_redemptions")
          .select("id,user_id")
          .eq("token_ref", claims.ref)
          .limit(1)
          .maybeSingle();
        if (error) return Response.json({ ok: false }, { status: 503 });
        if (existing?.user_id && existing.user_id !== user.id) {
          return Response.json({ ok: false, error: "This promo is linked to another account." }, { status: 409 });
        }
        if (existing) {
          if (!existing.user_id) await admin.from("promo_redemptions").update({ user_id: user.id }).eq("id", existing.id);
        } else {
          await admin.from("promo_redemptions").insert({ token_ref: claims.ref, user_id: user.id, expires_at: expiresAt, metadata: { plan: claims.plan, source: "claim" } });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
