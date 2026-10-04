import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createSupabaseAdmin, userFromRequest } from "@/lib/supabase.server";

export const Route = createFileRoute("/api/paystack/collect/pending")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await userFromRequest(request);
        const admin = createSupabaseAdmin();
        if (!user || !admin) return Response.json({ ok: true, payments: [] });
        const { data } = await admin
          .from("collected_payments")
          .select("id,customer_ref,customer_name,amount,reference,paid_at")
          .eq("user_id", user.id)
          .is("synced_at", null)
          .order("paid_at")
          .limit(100);
        return Response.json({ ok: true, payments: data ?? [] });
      },
      POST: async ({ request }) => {
        const user = await userFromRequest(request);
        const admin = createSupabaseAdmin();
        if (!user || !admin) return Response.json({ ok: false }, { status: 401 });
        const parsed = z.object({ ids: z.array(z.string().uuid()).max(100) }).safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
        await admin.from("collected_payments").update({ synced_at: new Date().toISOString() })
          .eq("user_id", user.id).in("id", parsed.data.ids);
        return Response.json({ ok: true });
      },
    },
  },
});
