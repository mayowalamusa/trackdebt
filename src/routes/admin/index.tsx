import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Tab =
  | "overview"
  | "users"
  | "subscriptions"
  | "payments"
  | "promos"
  | "announcements"
  | "broadcasts"
  | "brand"
  | "settings";

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

type Flag = { key: string; enabled: boolean; label: string; description: string | null };
type Broadcast = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  audience: string;
  recipient_count: number;
  sent_at: string;
};
type EventRow = {
  event_id: string;
  event_name: string;
  reference: string | null;
  created_at: string;
  amount: number | null;
  currency: string | null;
  user_id: string | null;
};
type SubscriptionRow = {
  user_id: string;
  plan: string;
  status: string;
  amount: number | null;
  current_period_end: string | null;
  last_successful_payment_at: string | null;
};

type Stats = {
  registered?: number;
  free?: number;
  plus?: number;
  newUsers30d?: number;
  visitorsToday?: number;
  visitorsMonth?: number;
  customers?: number;
  transactions?: number;
  recordedRevenue?: number;
};

type Management = {
  stats?: Stats;
  users?: UserRow[];
  subscriptions?: SubscriptionRow[];
  events?: EventRow[];
  broadcasts?: Broadcast[];
  flags?: Flag[];
};

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin — Track Debt" },
      { name: "description", content: "Track Debt administration: users, subscriptions, promos and app settings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPortal,
});

function AdminPortal() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const [brand, setBrand] = useState<Brand | null>(null);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [management, setManagement] = useState<Management>({});

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
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

    const [{ data: brandData }, { data: promoData }, { data: announcementData }] = await Promise.all([
      supabase.from("app_config").select("*").limit(1).maybeSingle(),
      supabase.from("promo_codes").select("*").order("created_at", { ascending: false }),
      supabase.from("announcements").select("*").order("priority", { ascending: false }).order("created_at", { ascending: false }),
    ]);

    setBrand(brandData);
    setPromos(promoData ?? []);
    setAnnouncements(announcementData ?? []);

    const response = await fetch("/api/admin/management", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (response.status === 401 || response.status === 403) {
      navigate({ to: "/admin/login" });
      return;
    }
    if (response.ok) setManagement(await response.json());
    else setError(await response.text());

    setReady(true);
  }

  async function action(body: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch("/api/admin/management", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await response.text());
      toast.success(successMessage);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That action did not go through.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  }

  const users = management.users ?? [];
  const stats = management.stats ?? {};
  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(term) ||
        u.plan.toLowerCase().includes(term) ||
        u.accountStatus.toLowerCase().includes(term),
    );
  }, [users, search]);

  if (!ready && !error) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading admin…</div>;
  }

  const nav: [Tab, string][] = [
    ["overview", "Overview"],
    ["users", "Users & Accounts"],
    ["subscriptions", "Subscriptions"],
    ["payments", "Payments"],
    ["promos", "Promo Codes"],
    ["broadcasts", "Announcements & Alerts"],
    ["brand", "Brand"],
    ["settings", "App Settings"],
  ];

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-medium text-primary">{brand?.app_name ?? "Track Debt"}</p>
            <h1 className="text-xl font-bold">Admin</h1>
          </div>
          <button onClick={signOut} className="rounded-lg border px-3 py-2 text-sm">
            Sign out
          </button>
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

        {tab === "overview" && <Overview stats={stats} promos={promos} announcements={announcements} />}
        {tab === "users" && (
          <UsersPanel users={filteredUsers} search={search} setSearch={setSearch} busy={busy} action={action} />
        )}
        {tab === "subscriptions" && <SubscriptionsPanel rows={management.subscriptions ?? []} />}
        {tab === "payments" && <PaymentsPanel events={management.events ?? []} />}
        {tab === "promos" && <PromoPanel promos={promos} onSaved={load} />}
        {tab === "broadcasts" && <BroadcastsPanel broadcasts={management.broadcasts ?? []} users={management.users ?? []} busy={busy} action={action} />}
        {tab === "brand" && <BrandPanel brand={brand} onSaved={load} />}
        {tab === "settings" && <SettingsPanel flags={management.flags ?? []} busy={busy} action={action} />}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-background p-5 shadow-sm">
      <h2 className="mb-5 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Card({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-xl border bg-background p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function Overview({ stats, promos, announcements }: { stats: Stats; promos: Promo[]; announcements: Announcement[] }) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">Business overview</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Registered users" value={stats.registered ?? 0} />
        <Card label="Free accounts" value={stats.free ?? 0} />
        <Card label="Active Plus" value={stats.plus ?? 0} />
        <Card label="New users (30d)" value={stats.newUsers30d ?? 0} />
        <Card label="Visitors today" value={stats.visitorsToday ?? 0} />
        <Card label="Visitors this month" value={stats.visitorsMonth ?? 0} />
        <Card label="Customers recorded" value={stats.customers ?? 0} />
        <Card label="Transactions recorded" value={stats.transactions ?? 0} />
        <Card label="Active promo codes" value={promos.filter((p) => p.is_active).length} />
        <Card label="Active announcements" value={announcements.filter((a) => a.is_active).length} />
      </div>
      <div className="mt-6 rounded-xl border bg-background p-5">
        <h3 className="font-semibold">Recorded subscription revenue</h3>
        <p className="mt-2 text-3xl font-bold">₦{Number(stats.recordedRevenue ?? 0).toLocaleString()}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Based on successful payment events captured automatically. Older payments may not include an amount.
        </p>
      </div>
    </section>
  );
}

function UsersPanel({
  users,
  search,
  setSearch,
  busy,
  action,
}: {
  users: UserRow[];
  search: string;
  setSearch: (v: string) => void;
  busy: boolean;
  action: (body: Record<string, unknown>, successMessage: string) => Promise<void>;
}) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">Users & accounts</h2>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search email, plan or status"
        className="mb-4 w-full max-w-xl rounded-lg border bg-background px-3 py-2.5"
      />
      <div className="overflow-x-auto rounded-xl border bg-background">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3">Email</th>
              <th className="p-3">Joined</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Status</th>
              <th className="p-3">Account</th>
              <th className="p-3">Admin</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="p-3">{u.email}</td>
                <td className="p-3">{new Date(u.createdAt).toLocaleDateString("en-NG")}</td>
                <td className="p-3">{u.plan}</td>
                <td className="p-3">{u.status}</td>
                <td className="p-3">{u.accountStatus}</td>
                <td className="p-3">{u.isAdmin ? "Yes" : "No"}</td>
                <td className="space-x-3 p-3">
                  <button
                    disabled={busy}
                    onClick={() =>
                      void action(
                        { action: "account_status", userId: u.id, status: u.accountStatus === "active" ? "suspended" : "active" },
                        u.accountStatus === "active" ? "Account suspended." : "Account restored.",
                      )
                    }
                    className="underline disabled:opacity-50"
                  >
                    {u.accountStatus === "active" ? "Suspend" : "Restore"}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void action(
                        { action: "admin_role", userId: u.id, makeAdmin: !u.isAdmin },
                        u.isAdmin ? "Admin access revoked." : "Admin access granted.",
                      )
                    }
                    className="underline disabled:opacity-50"
                  >
                    {u.isAdmin ? "Revoke admin" : "Make admin"}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                  No users match this search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SubscriptionsPanel({ rows }: { rows: SubscriptionRow[] }) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">Subscriptions</h2>
      <div className="overflow-x-auto rounded-xl border bg-background">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3">User</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Status</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Period end</th>
              <th className="p-3">Last payment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id} className="border-b last:border-0">
                <td className="p-3">{r.user_id}</td>
                <td className="p-3">{r.plan}</td>
                <td className="p-3">{r.status}</td>
                <td className="p-3">{r.amount ? "₦" + (Number(r.amount) / 100).toLocaleString() : "—"}</td>
                <td className="p-3">{r.current_period_end ? new Date(r.current_period_end).toLocaleDateString("en-NG") : "—"}</td>
                <td className="p-3">
                  {r.last_successful_payment_at ? new Date(r.last_successful_payment_at).toLocaleDateString("en-NG") : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  No subscriptions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PaymentsPanel({ events }: { events: EventRow[] }) {
  const rows = events.filter((e) => e.event_name === "charge.success" || e.event_name === "charge.failed");
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">Payment events</h2>
      <div className="overflow-x-auto rounded-xl border bg-background">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3">Date</th>
              <th className="p-3">Event</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Reference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.event_id} className="border-b last:border-0">
                <td className="p-3">{new Date(r.created_at).toLocaleString("en-NG")}</td>
                <td className="p-3">{r.event_name}</td>
                <td className="p-3">{r.amount ? "₦" + (Number(r.amount) / 100).toLocaleString() : "—"}</td>
                <td className="p-3">{r.reference ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-muted-foreground">
                  No payments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BrandPanel({ brand, onSaved }: { brand: Brand | null; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<Brand>(
    () =>
      brand ?? {
        id: "",
        app_name: "Track Debt",
        logo_url: "",
        support_email: "",
        website_url: "",
        developer: "",
        description: "",
        theme_color: "#be2323",
      },
  );
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (brand) setForm(brand);
  }, [brand]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("app_config")
      .update({
        app_name: form.app_name,
        logo_url: form.logo_url || null,
        support_email: form.support_email || null,
        website_url: form.website_url || null,
        developer: form.developer || null,
        description: form.description || null,
        theme_color: form.theme_color || null,
      })
      .eq("id", form.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Brand details saved.");
      await onSaved();
    }
  }

  return (
    <Panel title="Brand details">
      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            ["app_name", "App name"],
            ["logo_url", "Logo URL"],
            ["support_email", "Support email"],
            ["website_url", "Website URL"],
            ["developer", "Developer"],
            ["theme_color", "Theme colour"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block">
            <span className="mb-1.5 block text-sm font-medium">{label}</span>
            <input
              value={form[key] ?? ""}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="w-full rounded-lg border px-3 py-2.5"
            />
          </label>
        ))}
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm font-medium">Description</span>
          <textarea
            rows={4}
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border px-3 py-2.5"
          />
        </label>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </Panel>
  );
}

function PromoPanel({ promos, onSaved }: { promos: Promo[]; onSaved: () => Promise<void> }) {
  const empty: Promo = { id: "", code: "", plan: "plus", days: 30, max_uses: null, uses_count: 0, expires_at: null, is_active: true };
  const [form, setForm] = useState<Promo>(empty);

  async function save() {
    if (!form.code.trim()) {
      toast.error("Enter a code first.");
      return;
    }
    const payload = {
      code: form.code.trim().toUpperCase(),
      plan: form.plan,
      days: Number(form.days),
      max_uses: form.max_uses || null,
      expires_at: form.expires_at || null,
      is_active: form.is_active,
    };
    const result = form.id
      ? await supabase.from("promo_codes").update(payload).eq("id", form.id)
      : await supabase.from("promo_codes").insert(payload);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success(form.id ? "Promo code updated." : "Promo code created.");
      setForm(empty);
      await onSaved();
    }
  }

  async function toggleActive(promo: Promo) {
    const { error } = await supabase.from("promo_codes").update({ is_active: !promo.is_active }).eq("id", promo.id);
    if (error) toast.error(error.message);
    else {
      toast.success(promo.is_active ? "Promo code switched off." : "Promo code switched on.");
      await onSaved();
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this promo code?")) return;
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Promo code deleted.");
      await onSaved();
    }
  }

  return (
    <Panel title="Promo codes">
      <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-5">
        <input
          placeholder="CODE"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          className="rounded-lg border px-3 py-2"
        />
        <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} className="rounded-lg border px-3 py-2">
          <option value="plus">Plus</option>
          <option value="premium">Premium</option>
        </select>
        <input
          type="number"
          min="1"
          value={form.days}
          onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}
          className="rounded-lg border px-3 py-2"
        />
        <input
          type="number"
          min="1"
          placeholder="Max uses"
          value={form.max_uses ?? ""}
          onChange={(e) => setForm({ ...form, max_uses: e.target.value ? Number(e.target.value) : null })}
          className="rounded-lg border px-3 py-2"
        />
        <button onClick={save} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">
          {form.id ? "Update" : "Create"}
        </button>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Code</th>
              <th className="p-2">Plan</th>
              <th className="p-2">Days</th>
              <th className="p-2">Uses</th>
              <th className="p-2">Status</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {promos.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="p-2 font-medium">{p.code}</td>
                <td className="p-2">{p.plan}</td>
                <td className="p-2">{p.days}</td>
                <td className="p-2">
                  {p.uses_count}
                  {p.max_uses ? ` / ${p.max_uses}` : ""}
                </td>
                <td className="p-2">{p.is_active ? "Active" : "Inactive"}</td>
                <td className="space-x-3 p-2">
                  <button className="underline" onClick={() => setForm(p)}>
                    Edit
                  </button>
                  <button className="underline" onClick={() => void toggleActive(p)}>
                    {p.is_active ? "Switch off" : "Switch on"}
                  </button>
                  <button className="underline" onClick={() => void remove(p.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {promos.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  No promo codes yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function BroadcastsPanel({
  broadcasts,
  users,
  busy,
  action,
}: {
  broadcasts: Broadcast[];
  users: UserRow[];
  busy: boolean;
  action: (body: Record<string, unknown>, successMessage: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [audience, setAudience] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [category, setCategory] = useState("General");

  function send() {
    if (!title.trim() || !message.trim()) {
      toast.error("Add a title and a message.");
      return;
    }
    if (audience === "selected" && selected.length === 0) {
      toast.error("Choose at least one user.");
      return;
    }
    const fullTitle = category === "General" ? title.trim() : `${category}: ${title.trim()}`;
    void action({ action: "broadcast", title: fullTitle, message, link, audience, userIds: selected }, "Notification sent.").then(() => {
      setTitle("");
      setMessage("");
      setLink("");
      setSelected([]);
    });
  }

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">Announcements & alerts</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Messages go to each user's notification box in the app and pop up as a phone notification when they have notifications switched on.
      </p>
      <div className="space-y-3 rounded-xl border bg-background p-5">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border px-3 py-2">
          <option value="General">General announcement</option>
          <option value="Maintenance">Maintenance</option>
          <option value="New upgrade">New upgrade</option>
          <option value="Important">Important notice</option>
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full rounded-lg border px-3 py-2"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message"
          rows={4}
          className="w-full rounded-lg border px-3 py-2"
        />
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Optional link"
            className="rounded-lg border px-3 py-2"
          />
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className="rounded-lg border px-3 py-2">
            <option value="all">All registered users</option>
            <option value="free">Free users</option>
            <option value="plus">Plus users</option>
            <option value="selected">Selected users</option>
          </select>
        </div>
        {audience === "selected" && (
          <div className="rounded-lg border p-3">
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users by email"
              className="mb-2 w-full rounded-lg border px-3 py-2"
            />
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {users
                .filter((u) => u.email?.toLowerCase().includes(userSearch.toLowerCase()))
                .map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(u.id)}
                      onChange={(e) =>
                        setSelected((prev) => (e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)))
                      }
                    />
                    {u.email}
                  </label>
                ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{selected.length} selected</p>
          </div>
        )}
        <button disabled={busy} onClick={send} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">
          Send notification
        </button>
      </div>
      <div className="mt-6 space-y-2">
        {broadcasts.map((b) => (
          <div key={b.id} className="rounded-xl border bg-background p-4">
            <p className="font-semibold">{b.title}</p>
            <p className="mt-1 text-sm">{b.body}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Audience: {b.audience} · Recipients: {b.recipient_count} · {new Date(b.sent_at).toLocaleString("en-NG")}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SettingsPanel({
  flags,
  busy,
  action,
}: {
  flags: Flag[];
  busy: boolean;
  action: (body: Record<string, unknown>, successMessage: string) => Promise<void>;
}) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">App settings</h2>
      <div className="space-y-2">
        {flags.map((f) => (
          <div key={f.key} className="flex items-center justify-between rounded-xl border bg-background p-4">
            <div>
              <p className="font-medium">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.description}</p>
            </div>
            <button
              disabled={busy}
              onClick={() => void action({ action: "feature_flag", key: f.key, enabled: !f.enabled }, "Setting updated.")}
              className={`rounded-full px-3 py-1 text-sm ${f.enabled ? "bg-primary text-primary-foreground" : "border"}`}
            >
              {f.enabled ? "On" : "Off"}
            </button>
          </div>
        ))}
        {flags.length === 0 && <p className="text-sm text-muted-foreground">No settings available.</p>}
      </div>
    </section>
  );
}
