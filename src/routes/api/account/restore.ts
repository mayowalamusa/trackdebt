import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseAdmin, userFromRequest } from "@/lib/supabase.server";

export const Route = createFileRoute("/api/account/restore")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await userFromRequest(request);
        const admin = createSupabaseAdmin();
        if (!user) return Response.json({ ok: false, error: "Sign in required." }, { status: 401 });
        if (!admin) return Response.json({ ok: false, error: "Account service is not configured." }, { status: 503 });
        const { data: result, error } = await admin.rpc("trackdebt_restore_account", { target_user: user.id });
        if (error) return Response.json({ ok: false, error: "Could not restore the account." }, { status: 503 });
        if (result === "expired") return Response.json({ ok: false, error: "The restoration period has expired." }, { status: 410 });
        if (result === "not_found") return Response.json({ ok: false, error: "Account not found." }, { status: 404 });
        return Response.json({ ok: true, restored: result === "restored" || result === "active" });
      },
    },
  },
});