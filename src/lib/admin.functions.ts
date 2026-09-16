import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Not authorised");
}

export const checkAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { admin: !!data };
  });

export const getOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [profiles, subs, promos, announcements] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("subscriptions").select("user_id", { count: "exact", head: true }).eq("status", "active"),
      supabaseAdmin.from("promo_codes").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabaseAdmin.from("announcements").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);
    return {
      users: profiles.count ?? 0,
      subscribers: subs.count ?? 0,
      activePromos: promos.count ?? 0,
      activeAnnouncements: announcements.count ?? 0,
    };
  });

/* ---------------- Brand details ---------------- */

export const getBrand = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase.from("app_config").select("*").limit(1).maybeSingle();
    return data ?? null;
  });

export type BrandInput = {
  id?: string | null;
  app_name: string;
  logo_url: string | null;
  support_email: string | null;
  website_url: string | null;
  developer: string | null;
  description: string | null;
  theme_color: string | null;
};

export const saveBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: BrandInput) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload = { ...data, is_active: true };
    if (data.id) {
      const { error } = await context.supabase.from("app_config").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { id: _ignored, ...insert } = payload;
      const { error } = await context.supabase.from("app_config").insert(insert);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/* ---------------- Promo codes ---------------- */

export const listPromoCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export type PromoInput = {
  id?: string | null;
  code: string;
  plan: string;
  days: number;
  max_uses: number | null;
  expires_at: string | null;
  is_active: boolean;
};

export const savePromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PromoInput) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...rest } = data;
    const payload = { ...rest, code: rest.code.trim().toUpperCase() };
    if (id) {
      const { error } = await context.supabase.from("promo_codes").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("promo_codes").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deletePromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("promo_codes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Announcements ---------------- */

export const listAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("announcements").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export type AnnouncementInput = {
  id?: string | null;
  message: string;
  link: string | null;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

export const saveAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AnnouncementInput) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...payload } = data;
    if (id) {
      const { error } = await context.supabase.from("announcements").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("announcements").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Users ---------------- */

export type AdminUser = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  plan: string;
  status: string;
  accountStatus: string;
  isAdmin: boolean;
};

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUser[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authUsers, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(error.message);
    const [{ data: subs }, { data: roles }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("subscriptions").select("user_id,plan,status"),
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin.from("profiles").select("id,account_status"),
    ]);
    const subMap = new Map((subs ?? []).map((row: any) => [row.user_id, row]));
    const profileMap = new Map((profiles ?? []).map((row: any) => [row.id, row]));
    const adminIds = new Set((roles ?? []).filter((row: any) => row.role === "admin").map((row: any) => row.user_id));
    return authUsers.users.map((user) => ({
      id: user.id,
      email: user.email ?? "",
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
      plan: subMap.get(user.id)?.plan ?? "free",
      status: subMap.get(user.id)?.status ?? "free",
      accountStatus: profileMap.get(user.id)?.account_status ?? "active",
      isAdmin: adminIds.has(user.id),
    }));
  });

export const setUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; makeAdmin: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && !data.makeAdmin) throw new Error("You cannot remove your own admin access.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.makeAdmin) {
      const { error } = await supabaseAdmin.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
