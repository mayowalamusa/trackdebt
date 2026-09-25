import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseAdmin } from "@/lib/supabase.server";

export const Route = createFileRoute("/api/track-visit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { visitorId?: string };
          const visitorId = body.visitorId?.trim();
          if (!visitorId || visitorId.length > 100) return Response.json({ ok: false }, { status: 400 });
          const admin = createSupabaseAdmin();
          if (!admin) return Response.json({ ok: false }, { status: 503 });
          const now = new Date();
          const { error } = await admin.from("site_visits").upsert({ visitor_id: visitorId, visited_on: now.toISOString().slice(0, 10), last_seen_at: now.toISOString() }, { onConflict: "visitor_id,visited_on" });
          if (error) return Response.json({ ok: false }, { status: 500 });
          return Response.json({ ok: true });
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
      },
    },
  },
});