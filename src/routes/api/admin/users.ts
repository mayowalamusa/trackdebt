import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseAdmin, userFromRequest } from "@/lib/supabase.server";

async function assertAdmin(userId: string) {
  const admin = createSupabaseAdmin();
  if (!admin) throw new Error("Admin service is not configured.");
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Not authorised");
  return admin;
}

export const Route = createFileRoute("/api/admin/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await userFromRequest(request);
          if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
          const admin = await assertAdmin(user.id);
          const { data: authUsers, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
          if (error) return Response.json({ error: error.message }, { status: 500 });

          const [{ data: subs }, { data: roles }, { data: profiles }] = await Promise.all([
            admin.from("subscriptions").select("user_id,plan,status"),
            admin.from("user_roles").select("user_id,role"),
            admin.from("profiles").select("id,account_status"),
          ]);
          const subMap = new Map((subs ?? []).map((row: any) => [row.user_id, row]));
          const profileMap = new Map((profiles ?? []).map((row: any) => [row.id, row]));
          const adminIds = new Set((roles ?? []).filter((row: any) => row.role === "admin").map((row: any) => row.user_id));

          return Response.json(authUsers.users.map(user => ({
            id: user.id,
            email: user.email ?? "",
            createdAt: user.created_at,
            lastSignInAt: user.last_sign_in_at ?? null,
            plan: subMap.get(user.id)?.plan ?? "free",
            status: subMap.get(user.id)?.status ?? "free",
            accountStatus: profileMap.get(user.id)?.account_status ?? "active",
            isAdmin: adminIds.has(user.id),
          })));
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Not authorised" }, { status: 403 });
        }
      },
      PATCH: async ({ request }) => {
        try {
          const user = await userFromRequest(request);
          if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
          const admin = await assertAdmin(user.id);
          const body = await request.json() as { userId?: string; makeAdmin?: boolean };
          if (!body.userId || typeof body.makeAdmin !== "boolean") return Response.json({ error: "Invalid request." }, { status: 400 });
          if (body.userId === user.id && !body.makeAdmin) return Response.json({ error: "You cannot remove your own admin access." }, { status: 400 });

          if (body.makeAdmin) {
            const { error } = await admin.from("user_roles").upsert(
              { user_id: body.userId, role: "admin" },
              { onConflict: "user_id,role" },
            );
            if (error) return Response.json({ error: error.message }, { status: 500 });
          } else {
            const { error } = await admin.from("user_roles").delete().eq("user_id", body.userId).eq("role", "admin");
            if (error) return Response.json({ error: error.message }, { status: 500 });
          }
          return Response.json({ ok: true });
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Not authorised" }, { status: 403 });
        }
      },
    },
  },
});
