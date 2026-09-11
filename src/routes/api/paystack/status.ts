import { createFileRoute } from "@tanstack/react-router";
import { getEntitlement } from "@/lib/subscription.server";
import { createSupabaseAdmin, userFromRequest } from "@/lib/supabase.server";

export const Route = createFileRoute("/api/paystack/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await userFromRequest(request);
        if (!user) return Response.json({ ok: false, error: "Sign in required." }, { status: 401 });
        const admin = createSupabaseAdmin();
        if (!admin) return Response.json({ ok: false, error: "Billing is not configured." }, { status: 503 });
        try {
          return Response.json({ ok: true, entitlement: await getEntitlement(admin, user.id) });
        } catch (error) {
          console.error(error);
          return Response.json({ ok: false, error: "Could not load subscription status." }, { status: 503 });
        }
      },
    },
  },
});