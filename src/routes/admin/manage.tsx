import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Tab = "dashboard" | "users" | "notifications" | "subscriptions" | "payments" | "analytics" | "settings";
type UserRow = { id: string; email: string; createdAt: string; lastSignInAt: string | null; plan: string; status: string; accountStatus: string; isAdmin: boolean };
type Flag = { key: string; enabled: boolean; label: string; description: string | null };
type Broadcast = { id: string; title: string; body: string; link: string | null; audience: string; recipient_count: number; sent_at: string };
type EventRow = { event_id: string; event_name: string; reference: string | null; created_at: string; amount: number | null; currency: string | null; user_id: string | null };

export const Route = createFileRoute("/admin/manage")({
  head: () => ({ meta: [{ title: "Management — Track Debt Admin" }] }),
  component: Management,
});

function Management() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate({ to: "/admin/login" }); return; }
    const res = await fetch("/api/admin/management", { headers: { Authorization: "Bearer " + session.access_token } });
    if (res.status === 401 || res.status === 403) { navigate({ to: "/admin/login" }); return; }
    if (!res.ok) { setError(await res.text()); return; }
    setData(await res.json());
  };
  useEffect(() => { void load(); }, []);

  const action = async (body: Record<string, unknown>) => {
    setBusy(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/management", { method: "POST", headers: { Authorization: "Bearer " + session.access_token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed."); }
    finally { setBusy(false); }
  };

  const users: UserRow[] = data?.users ?? [];
  const filtered = useMemo(() => users.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()) || u.plan.includes(search.toLowerCase()) || u.accountStatus.includes(search.toLowerCase())), [users, search]);
  const stats = data?.stats ?? {};
  const nav: [Tab, string][] = [["dashboard", "Dashboard"], ["users", "Users"], ["notifications", "Notifications"], ["subscriptions", "Subscriptions"], ["payments", "Payments"], ["analytics", "Analytics"], ["settings", "App Settings"]];

  if (!data && !error) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading management…</div>;

  return <div className="min-h-screen bg-muted/20">
    <header className="border-b bg-background"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4"><div><p className="text-sm font-medium text-primary">Track Debt</p><h1 className="text-xl font-bold">Management</h1></div><Link to="/admin/" className="rounded-lg border px-3 py-2 text-sm">← Admin</Link></div></header>
    <main className="mx-auto max-w-7xl px-4 py-6">
      <nav className="mb-6 flex gap-2 overflow-x-auto">{nav.map(([v, l]) => <button key={v} onClick={() => setTab(v)} className={"whitespace-nowrap rounded-lg px-3 py-2 text-sm " + (tab === v ? "bg-primary text-primary-foreground" : "border bg-background")}>{l}</button>)}</nav>
      {error && <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {tab === "dashboard" && <Dashboard stats={stats} />}
      {tab === "users" && <Users users={filtered} search={search} setSearch={setSearch} busy={busy} action={action} />}
      {tab === "notifications" && <Notifications broadcasts={data?.broadcasts ?? []} busy={busy} action={action} />}
      {tab === "subscriptions" && <Subscriptions rows={data?.subscriptions ?? []} />}
      {tab === "payments" && <Payments events={data?.events ?? []} />}
      {tab === "analytics" && <Analytics stats={stats} />}
      {tab === "settings" && <Settings flags={data?.flags ?? []} busy={busy} action={action} />}
    </main>
  </div>;
}

function Card({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div className="rounded-xl border bg-background p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div>;
}

function Dashboard({ stats }: { stats: any }) {
  return <section><h2 className="mb-4 text-lg font-semibold">Business overview</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Card label="Registered users" value={stats.registered ?? 0} /><Card label="Free accounts" value={stats.free ?? 0} /><Card label="Active Plus" value={stats.plus ?? 0} /><Card label="New users (30d)" value={stats.newUsers30d ?? 0} />
    <Card label="Visitors today" value={stats.visitorsToday ?? 0} /><Card label="Visitors this month" value={stats.visitorsMonth ?? 0} /><Card label="Customers recorded" value={stats.customers ?? 0} /><Card label="Transactions recorded" value={stats.transactions ?? 0} />
  </div><div className="mt-6 rounded-xl border bg-background p-5"><h3 className="font-semibold">Recorded subscription revenue</h3><p className="mt-2 text-3xl font-bold">₦{Number(stats.recordedRevenue ?? 0).toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">Based on charge.success events captured by the webhook. Older payments may not include an amount.</p></div></section>;
}

function Users({ users, search, setSearch, busy, action }: { users: UserRow[]; search: string; setSearch: (v: string) => void; busy: boolean; action: (b: Record<string, unknown>) => Promise<void> }) {
  return <section><h2 className="mb-4 text-lg font-semibold">Users</h2><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search email, plan or status" className="mb-4 w-full max-w-xl rounded-lg border bg-background px-3 py-2.5" />
    <div className="overflow-x-auto rounded-xl border bg-background"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Email</th><th className="p-3">Joined</th><th className="p-3">Plan</th><th className="p-3">Status</th><th className="p-3">Account</th><th className="p-3">Admin</th><th className="p-3">Action</th></tr></thead><tbody>
      {users.map((u) => <tr key={u.id} className="border-b last:border-0"><td className="p-3">{u.email}</td><td className="p-3">{new Date(u.createdAt).toLocaleDateString("en-NG")}</td><td className="p-3">{u.plan}</td><td className="p-3">{u.status}</td><td className="p-3">{u.accountStatus}</td><td className="p-3">{u.isAdmin ? "Yes" : "No"}</td><td className="p-3"><button disabled={busy} onClick={() => void action({ action: "account_status", userId: u.id, status: u.accountStatus === "active" ? "deletion_pending" : "active" })} className="underline">{u.accountStatus === "active" ? "Suspend" : "Restore"}</button> <button disabled={busy} onClick={() => void action({ action: "admin_role", userId: u.id, makeAdmin: !u.isAdmin })} className="underline">{u.isAdmin ? "Revoke admin" : "Make admin"}</button></td></tr>)}
    </tbody></table></div></section>;
}

function Notifications({ broadcasts, busy, action }: { broadcasts: Broadcast[]; busy: boolean; action: (b: Record<string, unknown>) => Promise<void> }) {
  const [title, setTitle] = useState(""); const [message, setMessage] = useState(""); const [link, setLink] = useState(""); const [audience, setAudience] = useState("all");
  return <section><h2 className="mb-4 text-lg font-semibold">Notifications</h2><div className="rounded-xl border bg-background p-5 space-y-3">
    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-lg border px-3 py-2" /><textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message" rows={4} className="w-full rounded-lg border px-3 py-2" />
    <div className="grid gap-3 md:grid-cols-2"><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Optional link" className="rounded-lg border px-3 py-2" /><select value={audience} onChange={(e) => setAudience(e.target.value)} className="rounded-lg border px-3 py-2"><option value="all">All registered users</option><option value="free">Free users</option><option value="plus">Plus users</option></select></div>
    <button disabled={busy} onClick={() => { if (!title.trim() || !message.trim()) return; void action({ action: "broadcast", title, message, link, audience }).then(() => { setTitle(""); setMessage(""); setLink(""); }); }} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">Send notification</button>
  </div><div className="mt-6 space-y-2">{broadcasts.map((b) => <div key={b.id} className="rounded-xl border bg-background p-4"><p className="font-semibold">{b.title}</p><p className="mt-1 text-sm">{b.body}</p><p className="mt-2 text-xs text-muted-foreground">Audience: {b.audience} · Recipients: {b.recipient_count} · {new Date(b.sent_at).toLocaleString("en-NG")}</p></div>)}</div></section>;
}

function Subscriptions({ rows }: { rows: any[] }) {
  return <section><h2 className="mb-4 text-lg font-semibold">Subscriptions</h2><div className="overflow-x-auto rounded-xl border bg-background"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">User</th><th className="p-3">Plan</th><th className="p-3">Status</th><th className="p-3">Amount</th><th className="p-3">Period end</th><th className="p-3">Last payment</th></tr></thead><tbody>
    {rows.map((r) => <tr key={r.user_id} className="border-b last:border-0"><td className="p-3">{r.user_id}</td><td className="p-3">{r.plan}</td><td className="p-3">{r.status}</td><td className="p-3">{r.amount ? "₦" + (Number(r.amount) / 100).toLocaleString() : "—"}</td><td className="p-3">{r.current_period_end ? new Date(r.current_period_end).toLocaleDateString("en-NG") : "—"}</td><td className="p-3">{r.last_successful_payment_at ? new Date(r.last_successful_payment_at).toLocaleDateString("en-NG") : "—"}</td></tr>)}
  </tbody></table></div></section>;
}

function Payments({ events }: { events: EventRow[] }) {
  const rows = events.filter((e) => e.event_name === "charge.success" || e.event_name === "charge.failed");
  return <section><h2 className="mb-4 text-lg font-semibold">Payment events</h2><div className="overflow-x-auto rounded-xl border bg-background"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Date</th><th className="p-3">Event</th><th className="p-3">Amount</th><th className="p-3">Reference</th></tr></thead><tbody>
    {rows.map((r) => <tr key={r.event_id} className="border-b last:border-0"><td className="p-3">{new Date(r.created_at).toLocaleString("en-NG")}</td><td className="p-3">{r.event_name}</td><td className="p-3">{r.amount ? "₦" + (Number(r.amount) / 100).toLocaleString() : "—"}</td><td className="p-3">{r.reference ?? "—"}</td></tr>)}
  </tbody></table></div><p className="mt-2 text-xs text-muted-foreground">Only payment events captured with amount metadata are included in the revenue total.</p></section>;
}

function Analytics({ stats }: { stats: any }) {
  return <section><h2 className="mb-4 text-lg font-semibold">Analytics</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Card label="Unique visitors today" value={stats.visitorsToday ?? 0} /><Card label="Unique visitors this month" value={stats.visitorsMonth ?? 0} /><Card label="New registrations (30d)" value={stats.newUsers30d ?? 0} /><Card label="Registered free users" value={stats.free ?? 0} /><Card label="Active Plus users" value={stats.plus ?? 0} /></div><p className="mt-5 rounded-xl border bg-background p-4 text-sm text-muted-foreground">Anonymous visitors are counted separately from registered users. Someone who never creates an account is not counted as a free Track Debt account.</p></section>;
}

function Settings({ flags, busy, action }: { flags: Flag[]; busy: boolean; action: (b: Record<string, unknown>) => Promise<void> }) {
  return <section><h2 className="mb-4 text-lg font-semibold">App settings</h2><div className="space-y-2">{flags.map((f) => <div key={f.key} className="flex items-center justify-between rounded-xl border bg-background p-4"><div><p className="font-medium">{f.label}</p><p className="text-xs text-muted-foreground">{f.description}</p></div><button disabled={busy} onClick={() => void action({ action: "feature_flag", key: f.key, enabled: !f.enabled })} className={"rounded-full px-3 py-1 text-sm " + (f.enabled ? "bg-primary text-primary-foreground" : "border")}>{f.enabled ? "On" : "Off"}</button></div>)}</div><p className="mt-4 text-xs text-muted-foreground">These settings are stored centrally. A product surface must read a flag before the switch changes its behaviour.</p></section>;
}