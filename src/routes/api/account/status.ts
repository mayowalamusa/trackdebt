import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseAdmin, userFromRequest } from "@/lib/supabase.server";

export const Route = createFileRoute("/api/account/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await userFromRequest(request);
        const admin = createSupabaseAdmin();
        if (!user) return Response.json({ ok: false, error: "Sign in required." }, { status: 401 });
        if (!admin) return Response.json({ ok: false, error: "Account service is not configured." }, { status: 503 });
        const { data, error } = await admin.from("profiles").select("account_status,deletion_requested_at,restorable_until").eq("id", user.id).maybeSingle();
        if (error) return Response.json({ ok: false, error: "Could not load account status." }, { status: 503 });
        return Response.json({ ok: true, status: data?.account_status ?? "active", deletionRequestedAt: data?.deletion_requested_at ?? null, restorableUntil: data?.restorable_until ?? null });
      },
    },
  },
});