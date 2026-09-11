import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseAdmin, userFromRequest } from "@/lib/supabase.server";

export const Route = createFileRoute("/api/account/delete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await userFromRequest(request);
        const admin = createSupabaseAdmin();
        if (!user) return Response.json({ ok: false, error: "Sign in required." }, { status: 401 });
        if (!admin) return Response.json({ ok: false, error: "Account service is not configured." }, { status: 503 });
        const now = new Date();
        const restorableUntil = new Date(now.getTime() + 30 * 86_400_000).toISOString();
        const { error } = await admin.from("profiles").update({ account_status: "deletion_pending", deletion_requested_at: now.toISOString(), restorable_until: restorableUntil }).eq("id", user.id);
        if (error) return Response.json({ ok: false, error: "Could not start account deletion." }, { status: 503 });
        return Response.json({ ok: true, restorableUntil });
      },
    },
  },
});