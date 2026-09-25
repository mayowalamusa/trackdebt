import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseAdmin, userFromRequest } from "@/lib/supabase.server";

async function assertAdmin(request: Request) {
  const user = await userFromRequest(request);
  if (!user) throw new Response(JSON.stringify({ error: "Sign in required." }), { status: 401 });
  const admin = createSupabaseAdmin();
  if (!admin) throw new Response(JSON.stringify({ error: "Admin service is not configured." }), { status: 503 });
  const { data } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!data) throw new Response(JSON.stringify({ error: "Not authorised." }), { status: 403 });
  return { admin, user };
}

export const Route = createFileRoute("/api/admin/management")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { admin } = await assertAdmin(request);
          const [usersResult, profilesResult, subsResult, rolesResult, eventsResult, broadcastsResult, flagsResult] = await Promise.all([
            admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
            admin.from("profiles").select("id,account_status,created_at"),
            admin.from("subscriptions").select("user_id,plan,status,amount,currency,current_period_end,last_successful_payment_at,next_expected_payment_at,cancellation_at,last_transaction_reference"),
            admin.from("user_roles").select("user_id,role"),
            admin.from("subscription_events").select("event_id,event_name,reference,created_at,user_id,amount,currency").order("created_at", { ascending: false }).limit(100),
            admin.from("admin_broadcasts").select("*").order("created_at", { ascending: false }).limit(50),
            admin.from("app_feature_flags").select("*").order("key"),
          ]);
          if (usersResult.error) throw usersResult.error;
          const users = usersResult.data.users;
          const subscriptions = subsResult.data ?? [];
          const subMap = new Map(subscriptions.map((s: any) => [s.user_id, s]));
          const profileMap = new Map((profilesResult.data ?? []).map((p: any) => [p.id, p]));
          const adminIds = new Set((rolesResult.data ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id));
          const now = Date.now();
          const thirtyDaysAgo = now - 30 * 86400000;
          const registered = users.length;
          const free = users.filter((u) => (subMap.get(u.id)?.plan ?? 'free') === 'free').length;
          const plus = users.filter((u) => subMap.get(u.id)?.plan === 'plus' && subMap.get(u.id)?.status === 'active').length;
          const newUsers30d = users.filter((u) => new Date(u.created_at).getTime() >= thirtyDaysAgo).length;
          const today = new Date().toISOString().slice(0, 10);
          const { count: visitorsToday } = await admin.from("site_visits").select("visitor_id", { count: "exact", head: true }).eq("visited_on", today);
          const monthStart = new Date();
          monthStart.setUTCDate(1);
          const { count: visitorsMonth } = await admin.from("site_visits").select("visitor_id", { count: "exact", head: true }).gte("visited_on", monthStart.toISOString().slice(0, 10));
          const { count: customerCount } = await admin.from("customers").select("id", { count: "exact", head: true });
          const { count: transactionCount } = await admin.from("transactions").select("id", { count: "exact", head: true });
          const events = eventsResult.data ?? [];
          const recordedRevenue = events.filter((e: any) => e.event_name === 'charge.success' && Number(e.amount) > 0).reduce((sum: number, e: any) => sum + Number(e.amount) / 100, 0);
          return Response.json({
            stats: { registered, free, plus, newUsers30d, visitorsToday: visitorsToday ?? 0, visitorsMonth: visitorsMonth ?? 0, customers: customerCount ?? 0, transactions: transactionCount ?? 0, recordedRevenue },
            users: users.map((u) => ({ id: u.id, email: u.email ?? '', createdAt: u.created_at, lastSignInAt: u.last_sign_in_at ?? null, plan: subMap.get(u.id)?.plan ?? 'free', status: subMap.get(u.id)?.status ?? 'free', accountStatus: profileMap.get(u.id)?.account_status ?? 'active', isAdmin: adminIds.has(u.id) })),
            subscriptions,
            events,
            broadcasts: broadcastsResult.data ?? [],
            flags: flagsResult.data ?? [],
          });
        } catch (error) {
          if (error instanceof Response) return error;
          return Response.json({ error: error instanceof Error ? error.message : "Could not load admin data." }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        try {
          const { admin, user } = await assertAdmin(request);
          const body = (await request.json()) as Record<string, unknown>;
          if (body.action === 'broadcast') {
            const title = String(body.title ?? '').trim();
            const message = String(body.message ?? '').trim();
            const link = body.link ? String(body.link).trim() : null;
            const audience = ['all', 'free', 'plus'].includes(String(body.audience)) ? String(body.audience) : 'all';
            if (!title || !message) return Response.json({ error: "Title and message are required." }, { status: 400 });
            const usersResult = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
            if (usersResult.error) return Response.json({ error: usersResult.error.message }, { status: 500 });
            const ids = usersResult.data.users.map((u) => u.id);
            const { data: subs } = ids.length ? await admin.from('subscriptions').select('user_id,plan,status').in('user_id', ids) : { data: [] as any[] };
            const planMap = new Map((subs ?? []).map((s: any) => [s.user_id, s]));
            const recipients = ids.filter((id) => audience === 'all' || (audience === 'free' && (planMap.get(id)?.plan ?? 'free') === 'free') || (audience === 'plus' && planMap.get(id)?.plan === 'plus' && planMap.get(id)?.status === 'active'));
            const broadcastId = crypto.randomUUID();
            if (recipients.length) {
              const rows = recipients.map((id) => ({ user_id: id, legacy_id: 'admin-broadcast:' + broadcastId + ':' + id, customer_id: null, transaction_id: null, type: 'admin_broadcast', title, body: message, created_at: new Date().toISOString(), scheduled_for: new Date().toISOString(), read: false, status: 'delivered' }));
              const { error } = await admin.from('notifications').insert(rows);
              if (error) return Response.json({ error: error.message }, { status: 500 });
            }
            const { error: logError } = await admin.from('admin_broadcasts').insert({ id: broadcastId, title, body: message, link, audience, recipient_count: recipients.length, sent_by: user.id });
            if (logError) return Response.json({ error: logError.message }, { status: 500 });
            return Response.json({ ok: true, recipientCount: recipients.length });
          }
          if (body.action === 'account_status') {
            const userId = String(body.userId ?? '');
            const status = body.status === 'active' ? 'active' : body.status === 'deleted' ? 'deleted' : 'deletion_pending';
            if (!userId) return Response.json({ error: "User is required." }, { status: 400 });
            if (userId === user.id && status !== "active") return Response.json({ error: "You cannot suspend your own admin account." }, { status: 400 });
            const { error } = await admin.from('profiles').update({ account_status: status }).eq('id', userId);
            if (error) return Response.json({ error: error.message }, { status: 500 });
            return Response.json({ ok: true });
          }
          if (body.action === 'feature_flag') {
            const key = String(body.key ?? '');
            const enabled = Boolean(body.enabled);
            const { error } = await admin.from('app_feature_flags').update({ enabled, updated_at: new Date().toISOString() }).eq('key', key);
            if (error) return Response.json({ error: error.message }, { status: 500 });
            return Response.json({ ok: true });
          }
          return Response.json({ error: "Unknown action." }, { status: 400 });
        } catch (error) {
          if (error instanceof Response) return error;
          return Response.json({ error: error instanceof Error ? error.message : "Could not complete admin action." }, { status: 500 });
        }
      },
    },
  },
});