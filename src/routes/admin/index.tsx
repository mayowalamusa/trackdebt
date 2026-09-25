import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Tab = "overview" | "brand" | "promos" | "announcements" | "users";

type Brand = {
  id: string;
  app_name: string;
  logo_url: string | null;
  support_email: string | null;
  website_url: string | null;
  developer: string | null;
  description: string | null;
  theme_color: string | null;
};

type Promo = {
  id: string;
  code: string;
  plan: string;
  days: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
};

type Announcement = {
  id: string;
  message: string;
  link: string | null;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

type UserRow = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  plan: string;
  status: string;
  accountStatus: string;
  isAdmin: boolean;
};

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin — Track Debt" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [brand, setBrand] = useState<Brand | null>(null);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [counts, setCounts] = useState({ users: 0, subscribers: 0, activePromos: 0, activeAnnouncements: 0 });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate({ to: "/admin/login" });
      return;
    }

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!role) {
      await supabase.auth.signOut();
      navigate({ to: "/admin/login" });
      return;
    }

    const [{ data: brandData }, { data: promoData }, { data: announcementData }, { count: userCount }] =
      await Promise.all([
        supabase.from("app_config").select("*").limit(1).maybeSingle(),
        supabase.from("promo_codes").select("*").order("created_at", { ascending: false }),
        supabase.from("announcements").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

    const { count: subscriberCount } = await supabase
      .from("subscriptions")
      .select("user_id", { count: "exact", head: true })
      .eq("status", "active");

    setBrand(brandData);
    setPromos(promoData ?? []);
    setAnnouncements(announcementData ?? []);
    setCounts({
      users: userCount ?? 0,
      subscribers: subscriberCount ?? 0,
      activePromos: (promoData ?? []).filter((p) => p.is_active).length,
      activeAnnouncements: (announcementData ?? []).filter((a) => a.is_active).length,
    });

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) {
      const response = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) setUsers(await response.json());
    }

    setReady(true);
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  }

  if (!ready && loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading admin…</div>;
  }

  const nav: [Tab, string][] = [
    ["overview", "Overview"],
    ["brand", "Brand"],
    ["promos", "Promo Codes"],
    ["announcements", "Announcements"],
    ["users", "Users"],
  ];

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-medium text-primary">Track Debt</p>
            <h1 className="text-xl font-bold">Admin</h1>
          </div>
          <div className="flex items-center gap-2"><Link to="/admin/manage" className="rounded-lg border px-3 py-2 text-sm">Management</Link><button onClick={signOut} className="rounded-lg border px-3 py-2 text-sm">Sign out</button></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <nav className="mb-6 flex gap-2 overflow-x-auto">
          {nav.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${tab === value ? "bg-primary text-primary-foreground" : "border bg-background"}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {error && <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

        {tab === "overview" && <Overview counts={counts} />}
        {tab === "brand" && <BrandPanel brand={brand} onSaved={load} />}
        {tab === "promos" && <PromoPanel promos={promos} onSaved={load} />}
        {tab === "announcements" && <AnnouncementPanel announcements={announcements} onSaved={load} />}
        {tab === "users" && <UsersPanel users={users} onSaved={load} />}
      </div>
    </div>
  );
}

function Overview({ counts }: { counts: { users: number; subscribers: number; activePromos: number; activeAnnouncements: number } }) {
  const cards = [
    ["Users", counts.users],
    ["Paying subscribers", counts.subscribers],
    ["Active promo codes", counts.activePromos],
    ["Active announcements", counts.activeAnnouncements],
  ];
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">Overview</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-background p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BrandPanel({ brand, onSaved }: { brand: Brand | null; onSaved: () => void }) {
  const [form, setForm] = useState<Brand>(() => brand ?? {
    id: "", app_name: "Track Debt", logo_url: "", support_email: "", website_url: "",
    developer: "", description: "", theme_color: "#be2323",
  });
  useEffect(() => { if (brand) setForm(brand); }, [brand]);

  async function save() {
    const { error } = await supabase.from("app_config").update({
      app_name: form.app_name, logo_url: form.logo_url || null, support_email: form.support_email || null,
      website_url: form.website_url || null, developer: form.developer || null,
      description: form.description || null, theme_color: form.theme_color || null,
    }).eq("id", form.id);
    if (error) alert(error.message); else alert("Brand details saved.");
    onSaved();
  }

  return <Panel title="Brand details">
    <div className="grid gap-4 md:grid-cols-2">
      {([
        ["app_name", "App name"], ["logo_url", "Logo URL"], ["support_email", "Support email"],
        ["website_url", "Website URL"], ["developer", "Developer"], ["theme_color", "Theme colour"],
      ] as const).map(([key, label]) => (
        <label key={key} className="block"><span className="mb-1.5 block text-sm font-medium">{label}</span>
          <input value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-full rounded-lg border px-3 py-2.5" />
        </label>
      ))}
      <label className="block md:col-span-2"><span className="mb-1.5 block text-sm font-medium">Description</span>
        <textarea rows={4} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border px-3 py-2.5" />
      </label>
    </div>
    <button onClick={save} className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground">Save changes</button>
  </Panel>;
}

function PromoPanel({ promos, onSaved }: { promos: Promo[]; onSaved: () => void }) {
  const empty: Promo = { id: "", code: "", plan: "plus", days: 30, max_uses: null, uses_count: 0, expires_at: null, is_active: true };
  const [form, setForm] = useState<Promo>(empty);

  async function save() {
    const payload = { code: form.code.trim().toUpperCase(), plan: form.plan, days: Number(form.days), max_uses: form.max_uses || null, expires_at: form.expires_at || null, is_active: form.is_active };
    const result = form.id ? await supabase.from("promo_codes").update(payload).eq("id", form.id) : await supabase.from("promo_codes").insert(payload);
    if (result.error) alert(result.error.message); else { setForm(empty); onSaved(); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this promo code?")) return;
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    if (error) alert(error.message); else onSaved();
  }

  return <Panel title="Promo codes">
    <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-5">
      <input placeholder="CODE" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="rounded-lg border px-3 py-2" />
      <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} className="rounded-lg border px-3 py-2"><option value="plus">Plus</option><option value="premium">Premium</option></select>
      <input type="number" min="1" value={form.days} onChange={e => setForm({ ...form, days: Number(e.target.value) })} className="rounded-lg border px-3 py-2" />
      <input type="number" min="1" placeholder="Max uses" value={form.max_uses ?? ""} onChange={e => setForm({ ...form, max_uses: e.target.value ? Number(e.target.value) : null })} className="rounded-lg border px-3 py-2" />
      <button onClick={save} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">{form.id ? "Update" : "Create"}</button>
    </div>
    <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Code</th><th className="p-2">Plan</th><th className="p-2">Days</th><th className="p-2">Uses</th><th className="p-2">Status</th><th className="p-2"></th></tr></thead><tbody>
      {promos.map(p => <tr key={p.id} className="border-b"><td className="p-2 font-medium">{p.code}</td><td className="p-2">{p.plan}</td><td className="p-2">{p.days}</td><td className="p-2">{p.uses_count}{p.max_uses ? ` / ${p.max_uses}` : ""}</td><td className="p-2">{p.is_active ? "Active" : "Inactive"}</td><td className="p-2"><button className="mr-2 underline" onClick={() => setForm(p)}>Edit</button><button className="underline" onClick={() => remove(p.id)}>Delete</button></td></tr>)}
    </tbody></table></div>
  </Panel>;
}

function AnnouncementPanel({ announcements, onSaved }: { announcements: Announcement[]; onSaved: () => void }) {
  const empty: Announcement = { id: "", message: "", link: "", priority: 0, starts_at: null, ends_at: null, is_active: true };
  const [form, setForm] = useState<Announcement>(empty);

  async function save() {
    const payload = { message: form.message.trim(), link: form.link || null, priority: Number(form.priority), starts_at: form.starts_at || null, ends_at: form.ends_at || null, is_active: form.is_active };
    const result = form.id ? await supabase.from("announcements").update(payload).eq("id", form.id) : await supabase.from("announcements").insert(payload);
    if (result.error) alert(result.error.message); else { setForm(empty); onSaved(); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this announcement?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) alert(error.message); else onSaved();
  }

  return <Panel title="Announcements">
    <div className="space-y-3 rounded-xl border p-4">
      <textarea rows={3} placeholder="Announcement message" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className="w-full rounded-lg border px-3 py-2" />
      <div className="grid gap-3 md:grid-cols-4">
        <input placeholder="Link (optional)" value={form.link ?? ""} onChange={e => setForm({ ...form, link: e.target.value })} className="rounded-lg border px-3 py-2" />
        <input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} className="rounded-lg border px-3 py-2" />
        <input type="datetime-local" value={form.starts_at ? form.starts_at.slice(0,16) : ""} onChange={e => setForm({ ...form, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className="rounded-lg border px-3 py-2" />
        <input type="datetime-local" value={form.ends_at ? form.ends_at.slice(0,16) : ""} onChange={e => setForm({ ...form, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className="rounded-lg border px-3 py-2" />
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
      <button onClick={save} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">{form.id ? "Update" : "Create"}</button>
    </div>
    <div className="mt-5 space-y-2">{announcements.map(a => <div key={a.id} className="flex items-center justify-between rounded-xl border p-3"><div><p className="font-medium">{a.message}</p><p className="text-xs text-muted-foreground">Priority {a.priority} · {a.is_active ? "Active" : "Inactive"}</p></div><div><button className="mr-3 underline" onClick={() => setForm(a)}>Edit</button><button className="underline" onClick={() => remove(a.id)}>Delete</button></div></div>)}</div>
  </Panel>;
}

function UsersPanel({ users, onSaved }: { users: UserRow[]; onSaved: () => void }) {
  async function toggle(user: UserRow) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, makeAdmin: !user.isAdmin }),
    });
    if (!response.ok) alert(await response.text()); else onSaved();
  }

  return <Panel title="Users">
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Email</th><th className="p-2">Joined</th><th className="p-2">Plan</th><th className="p-2">Subscription</th><th className="p-2">Account</th><th className="p-2">Admin</th><th className="p-2"></th></tr></thead><tbody>
      {users.map(u => <tr key={u.id} className="border-b"><td className="p-2">{u.email}</td><td className="p-2">{new Date(u.createdAt).toLocaleDateString()}</td><td className="p-2">{u.plan}</td><td className="p-2">{u.status}</td><td className="p-2">{u.accountStatus}</td><td className="p-2">{u.isAdmin ? "Yes" : "No"}</td><td className="p-2"><button onClick={() => toggle(u)} className="underline">{u.isAdmin ? "Revoke" : "Grant"}</button></td></tr>)}
    </tbody></table></div>
  </Panel>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border bg-background p-5 shadow-sm"><h2 className="mb-5 text-lg font-semibold">{title}</h2>{children}</section>;
}
