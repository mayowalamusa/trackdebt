import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Plus,
  MessageCircle,
  Search,
  X,
  Pencil,
  Trash2,
  Store,
  Receipt,
  StickyNote,
  Users,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Camera,
} from "lucide-react";
import {
  BUSINESS_CATEGORIES,
  balanceOf,
  fmtDate,
  isOverdue,
  lastActivity,
  naira,
  receiptMessage,
  reminderMessage,
  statementMessage,
  thisMonth,
  todayISO,
  waLink,
  type BusinessProfile,
  type Customer,
  type Txn,
} from "@/lib/ledger";
import { usePersistentCustomers, usePersistentProfile } from "@/lib/use-ledger-storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TrackDebt — Customer Credit Ledger in Naira" },
      {
        name: "description",
        content:
          "Record credit sales and payments, track who owes you, filter overdue customers and send WhatsApp reminders and receipts.",
      },
      { property: "og:title", content: "TrackDebt — Customer Credit Ledger in Naira" },
      {
        property: "og:description",
        content:
          "A simple offline ledger for small businesses: customers, credit sales, payments and WhatsApp reminders.",
      },
    ],
  }),
  component: DebtTracker,
});

type Screen =
  | "list"
  | "detail"
  | "addCustomer"
  | "editCustomer"
  | "addTxn"
  | "editTxn"
  | "profile";

type Filter = "all" | "outstanding" | "settled" | "overdue";
type Sort = "newest" | "highest";

const emptyForm = { name: "", phone: "", notes: "", amount: "", note: "" };

function DebtTracker() {
  const [profile, setProfile, profileLoaded] = usePersistentProfile();
  const [customers, setCustomers, customersLoaded] = usePersistentCustomers();
  const loaded = profileLoaded && customersLoaded;

  const [screen, setScreen] = useState<Screen>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTxnId, setEditingTxnId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("highest");
  const [txnType, setTxnType] = useState<Txn["type"]>("sale");
  const [payKind, setPayKind] = useState<"full" | "partial">("partial");
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  const selected = customers.find((c) => c.id === selectedId) ?? null;
  const resetForm = () => setForm(emptyForm);
  const go = (s: Screen) => {
    setConfirmDelete(null);
    setScreen(s);
  };

  /* ---------- dashboard stats ---------- */
  const stats = useMemo(() => {
    let outstanding = 0;
    let overdue = 0;
    let collections = 0;
    let creditSales = 0;
    const activity: { c: Customer; t: Txn }[] = [];
    for (const c of customers) {
      outstanding += Math.max(balanceOf(c), 0);
      if (isOverdue(c)) overdue += 1;
      for (const t of c.txns) {
        if (thisMonth(t.date)) {
          if (t.type === "payment") collections += t.amount;
          else creditSales += t.amount;
        }
        activity.push({ c, t });
      }
    }
    activity.sort((a, b) => (a.t.date < b.t.date ? 1 : a.t.date > b.t.date ? -1 : 0));
    return { outstanding, overdue, collections, creditSales, activity: activity.slice(0, 5) };
  }, [customers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers
      .filter((c) => {
        if (q) {
          const hit =
            c.name.toLowerCase().includes(q) ||
            c.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
            c.notes.toLowerCase().includes(q) ||
            c.txns.some((t) => t.note.toLowerCase().includes(q));
          if (!hit) return false;
        }
        const bal = balanceOf(c);
        if (filter === "outstanding") return bal > 0;
        if (filter === "settled") return bal <= 0;
        if (filter === "overdue") return isOverdue(c);
        return true;
      })
      .sort((a, b) =>
        sort === "newest"
          ? lastActivity(b).localeCompare(lastActivity(a))
          : balanceOf(b) - balanceOf(a),
      );
  }, [customers, query, filter, sort]);

  /* ---------- mutations ---------- */
  const addCustomer = () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    setCustomers((cs) => [
      ...cs,
      {
        id: "c" + Date.now(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        notes: form.notes.trim(),
        createdAt: todayISO(),
        txns: [],
      },
    ]);
    resetForm();
    go("list");
  };

  const saveCustomerEdit = () => {
    if (!selectedId || !form.name.trim() || !form.phone.trim()) return;
    setCustomers((cs) =>
      cs.map((c) =>
        c.id === selectedId
          ? {
              ...c,
              name: form.name.trim(),
              phone: form.phone.trim(),
              notes: form.notes.trim(),
            }
          : c,
      ),
    );
    resetForm();
    go("detail");
  };

  const deleteCustomer = () => {
    if (!selectedId) return;
    setCustomers((cs) => cs.filter((c) => c.id !== selectedId));
    setSelectedId(null);
    resetForm();
    go("list");
  };

  const addTxn = () => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0 || !selectedId || !selected) return;
    const bal = balanceOf(selected);
    const t: Txn = {
      id: "t" + Date.now(),
      type: txnType,
      amount: amt,
      date: todayISO(),
      note: form.note.trim(),
      ...(txnType === "payment" ? { kind: amt >= bal ? "full" : "partial" } : {}),
    };
    setCustomers((cs) =>
      cs.map((c) => (c.id === selectedId ? { ...c, txns: [...c.txns, t] } : c)),
    );
    resetForm();
    go("detail");
  };

  const saveTxnEdit = () => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0 || !selectedId || !editingTxnId) return;
    setCustomers((cs) =>
      cs.map((c) => {
        if (c.id !== selectedId) return c;
        const others = c.txns
          .filter((t) => t.id !== editingTxnId)
          .reduce((s, t) => s + (t.type === "sale" ? t.amount : -t.amount), 0);
        return {
          ...c,
          txns: c.txns.map((t): Txn => {
            if (t.id !== editingTxnId) return t;
            const base: Txn = {
              id: t.id,
              date: t.date,
              type: txnType,
              amount: amt,
              note: form.note.trim(),
            };
            if (txnType === "payment") base.kind = amt >= others ? "full" : "partial";
            return base;
          }),

        };
      }),
    );
    setEditingTxnId(null);
    resetForm();
    go("detail");
  };

  const deleteTxn = (txnId: string) => {
    if (!selectedId) return;
    setCustomers((cs) =>
      cs.map((c) =>
        c.id === selectedId ? { ...c, txns: c.txns.filter((t) => t.id !== txnId) } : c,
      ),
    );
    setConfirmDelete(null);
  };

  const openEditTxn = (t: Txn) => {
    setEditingTxnId(t.id);
    setTxnType(t.type);
    setPayKind(t.kind ?? "partial");
    setForm({ ...emptyForm, amount: String(t.amount), note: t.note });
    go("editTxn");
  };

  const onLogo = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProfile((p) => ({ ...p, logo: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const setP = (patch: Partial<BusinessProfile>) => setProfile((p) => ({ ...p, ...patch }));

  const bizLabel = (profile.name || "Your business").toUpperCase();

  /* ---------- render ---------- */
  return (
    <main className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-paper relative pb-28 shadow-sm">
        {/* ===== LIST / DASHBOARD ===== */}
        {screen === "list" && (
          <div className="animate-in fade-in duration-200">
            <header className="px-5 pt-9 pb-6 border-b border-line bg-paper-raised">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {profile.logo ? (
                    <img
                      src={profile.logo}
                      alt={`${profile.name || "Business"} logo`}
                      className="h-9 w-9 rounded object-cover border border-line"
                    />
                  ) : (
                    <span className="h-9 w-9 rounded border border-line grid place-items-center text-ink-soft">
                      <Store size={16} />
                    </span>
                  )}
                  <h1 className="mono text-[11px] tracking-[0.18em] text-ink-soft font-semibold truncate">
                    {bizLabel}
                  </h1>
                </div>
                <button
                  onClick={() => go("profile")}
                  aria-label="Business profile"
                  className="text-ink-soft transition-opacity active:opacity-60"
                >
                  <Pencil size={15} />
                </button>
              </div>

              <p className="mono text-[10px] tracking-[0.2em] text-ink-soft mt-6">
                OUTSTANDING BALANCE
              </p>
              <p className="mono text-[2.6rem] leading-none font-bold text-debt mt-2">
                {naira(stats.outstanding)}
              </p>

              <div className="grid grid-cols-2 gap-2.5 mt-6">
                <Stat
                  icon={<Users size={13} />}
                  label="Customers"
                  value={String(customers.length)}
                />
                <Stat
                  icon={<AlertTriangle size={13} />}
                  label="Overdue"
                  value={String(stats.overdue)}
                  tone={stats.overdue ? "debt" : undefined}
                />
                <Stat
                  icon={<TrendingUp size={13} />}
                  label="Collected (mo.)"
                  value={naira(stats.collections)}
                  tone="paid"
                />
                <Stat
                  icon={<TrendingDown size={13} />}
                  label="Credit sales (mo.)"
                  value={naira(stats.creditSales)}
                  tone="debt"
                />
              </div>
            </header>

            {!loaded ? (
              <div className="p-5 space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 rounded bg-muted/70 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {stats.activity.length > 0 && (
                  <section className="border-b border-line">
                    <p className="mono text-[10px] tracking-widest text-ink-soft px-5 pt-5 pb-2">
                      RECENT ACTIVITY
                    </p>
                    {stats.activity.map(({ c, t }) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setSelectedId(c.id);
                          go("detail");
                        }}
                        className="ledger-row w-full flex items-center justify-between px-5 py-2.5 text-left transition-colors active:bg-muted"
                      >
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium truncate">{c.name}</span>
                          <span className="block text-[11px] text-ink-soft">
                            {t.type === "sale"
                              ? "Credit sale"
                              : t.kind === "partial"
                                ? "Part payment"
                                : "Full payment"}{" "}
                            · {fmtDate(t.date)}
                          </span>
                        </span>
                        <span
                          className={`mono text-[13px] font-bold ${
                            t.type === "sale" ? "text-debt" : "text-paid"
                          }`}
                        >
                          {t.type === "sale" ? "+" : "−"}
                          {naira(t.amount)}
                        </span>
                      </button>
                    ))}
                  </section>
                )}

                <div className="px-5 pt-5 pb-3 space-y-3">
                  <div className="flex items-center gap-2 input-field rounded px-3 py-2.5">
                    <Search size={15} className="text-ink-soft" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search name, phone or note"
                      className="bg-transparent w-full text-sm outline-none text-ink"
                    />
                    {query && (
                      <button onClick={() => setQuery("")} aria-label="Clear search">
                        <X size={14} className="text-ink-soft" />
                      </button>
                    )}
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                    {(
                      [
                        ["all", "All"],
                        ["outstanding", "Outstanding"],
                        ["settled", "Settled"],
                        ["overdue", "Overdue"],
                      ] as const
                    ).map(([key, label]) => (
                      <Chip
                        key={key}
                        active={filter === key}
                        onClick={() => setFilter(key)}
                        label={label}
                      />
                    ))}
                    <span className="w-px bg-line shrink-0 mx-0.5" />
                    <Chip
                      active={sort === "newest"}
                      onClick={() => setSort("newest")}
                      label="Newest"
                    />
                    <Chip
                      active={sort === "highest"}
                      onClick={() => setSort("highest")}
                      label="Highest debt"
                    />
                  </div>
                </div>

                <section>
                  {filtered.length === 0 && (
                    <div className="px-8 py-14 text-center animate-in fade-in duration-300">
                      <span className="mx-auto h-12 w-12 rounded-full perforated grid place-items-center text-ink-soft">
                        <Users size={20} />
                      </span>
                      <p className="text-sm font-semibold mt-4">
                        {customers.length === 0
                          ? "Your ledger is empty"
                          : "Nothing matches this view"}
                      </p>
                      <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">
                        {customers.length === 0
                          ? "Add your first customer to start recording credit sales and payments."
                          : "Try a different filter or clear your search."}
                      </p>
                    </div>
                  )}
                  {filtered.map((c) => {
                    const bal = balanceOf(c);
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedId(c.id);
                          go("detail");
                        }}
                        className="ledger-row w-full flex items-center justify-between px-5 py-3.5 text-left gap-3 transition-colors active:bg-muted"
                      >
                        <span className="min-w-0">
                          <span className="block font-semibold text-[15px] text-ink truncate">
                            {c.name}
                          </span>
                          <span className="text-[11px] text-ink-soft mt-1 flex items-center gap-2">
                            <span>last activity {fmtDate(lastActivity(c))}</span>
                            {isOverdue(c) && <span className="stamp text-debt">overdue</span>}
                          </span>
                        </span>
                        <span
                          className={`mono text-sm font-bold shrink-0 ${
                            bal > 0 ? "text-debt" : bal < 0 ? "text-paid" : "text-ink-soft"
                          }`}
                        >
                          {bal === 0 ? "settled" : naira(Math.abs(bal))}
                        </span>
                      </button>
                    );
                  })}
                </section>
              </>
            )}

            <button
              onClick={() => {
                resetForm();
                go("addCustomer");
              }}
              aria-label="Add customer"
              className="btn-primary rounded-full flex items-center justify-center shadow-lg fixed bottom-6 h-14 w-14 right-[max(1.25rem,calc(50%-215px+1.25rem))] transition-transform active:scale-95"
            >
              <Plus size={24} />
            </button>
          </div>
        )}

        {/* ===== BUSINESS PROFILE ===== */}
        {screen === "profile" && (
          <div className="p-5 animate-in fade-in slide-in-from-right-2 duration-200">
            <Header title="Business profile" onClose={() => go("list")} />

            <div className="flex items-center gap-4 mb-7">
              {profile.logo ? (
                <img
                  src={profile.logo}
                  alt="Business logo"
                  className="h-16 w-16 rounded object-cover border border-line"
                />
              ) : (
                <span className="h-16 w-16 rounded perforated grid place-items-center text-ink-soft">
                  <Store size={22} />
                </span>
              )}
              <div className="space-y-1.5">
                <button
                  onClick={() => logoInput.current?.click()}
                  className="flex items-center gap-2 text-sm font-semibold text-ink"
                >
                  <Camera size={15} /> {profile.logo ? "Change logo" : "Upload logo"}
                </button>
                {profile.logo && (
                  <button
                    onClick={() => setP({ logo: "" })}
                    className="text-[12px] text-ink-soft block"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={logoInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onLogo(e.target.files?.[0])}
              />
            </div>

            <Field label="BUSINESS NAME">
              <input
                value={profile.name}
                onChange={(e) => setP({ name: e.target.value })}
                placeholder="e.g. Amaka Provisions"
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="PHONE">
              <input
                value={profile.phone}
                onChange={(e) => setP({ phone: e.target.value })}
                inputMode="tel"
                placeholder="080..."
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="EMAIL">
              <input
                value={profile.email}
                onChange={(e) => setP({ email: e.target.value })}
                inputMode="email"
                placeholder="you@business.com"
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="ADDRESS">
              <textarea
                value={profile.address}
                onChange={(e) => setP({ address: e.target.value })}
                rows={2}
                placeholder="Shop 12, Main Market..."
                className="input-field w-full rounded px-3 py-2.5 text-sm resize-none"
              />
            </Field>
            <Field label="CATEGORY">
              <select
                value={profile.category}
                onChange={(e) => setP({ category: e.target.value })}
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              >
                <option value="">Select a category</option>
                {BUSINESS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <p className="text-[11px] text-ink-soft leading-relaxed mt-2 mb-6">
              These details appear on your receipts, statements and WhatsApp reminders. Everything
              is saved on this device only.
            </p>

            <button
              onClick={() => go("list")}
              className="btn-primary w-full rounded py-3 text-sm font-semibold transition-transform active:scale-[0.99]"
            >
              Done
            </button>
          </div>
        )}

        {/* ===== ADD / EDIT CUSTOMER ===== */}
        {(screen === "addCustomer" || screen === "editCustomer") && (
          <div className="p-5 animate-in fade-in slide-in-from-right-2 duration-200">
            <Header
              title={screen === "addCustomer" ? "New customer" : "Edit customer"}
              onClose={() => {
                resetForm();
                go(screen === "addCustomer" ? "list" : "detail");
              }}
            />

            <Field label="NAME">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Chidi Electronics"
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="WHATSAPP NUMBER">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="080..."
                inputMode="tel"
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="NOTES (OPTIONAL)">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="e.g. Pays every Friday · Don't exceed ₦30,000"
                className="input-field w-full rounded px-3 py-2.5 text-sm resize-none"
              />
            </Field>

            <button
              onClick={screen === "addCustomer" ? addCustomer : saveCustomerEdit}
              disabled={!form.name.trim() || !form.phone.trim()}
              className="btn-primary w-full rounded py-3 text-sm font-semibold mt-2 disabled:opacity-40 transition-transform active:scale-[0.99]"
            >
              {screen === "addCustomer" ? "Save customer" : "Save changes"}
            </button>

            {screen === "editCustomer" && selected && (
              <div className="perforated rounded mt-8 p-4">
                {confirmDelete === "customer" ? (
                  <div className="animate-in fade-in duration-150">
                    <p className="text-sm text-ink leading-relaxed">
                      Delete {selected.name} and all {selected.txns.length} transactions? This
                      cannot be undone.
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="rounded py-2 text-sm font-semibold border border-line bg-paper-raised"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={deleteCustomer}
                        className="rounded py-2 text-sm font-semibold bg-destructive text-destructive-foreground"
                      >
                        Yes, delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete("customer")}
                    className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-debt py-1"
                  >
                    <Trash2 size={15} /> Delete customer
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== ADD / EDIT TRANSACTION ===== */}
        {(screen === "addTxn" || screen === "editTxn") && selected && (
          <div className="p-5 animate-in fade-in slide-in-from-right-2 duration-200">
            <Header
              title={`${screen === "editTxn" ? "Edit entry · " : ""}${selected.name}`}
              onClose={() => {
                resetForm();
                setEditingTxnId(null);
                go("detail");
              }}
            />

            <div className="flex rounded overflow-hidden border border-line mb-4">
              {(["sale", "payment"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTxnType(t)}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                    txnType === t ? "bg-ink text-paper-raised" : "bg-paper-raised text-ink-soft"
                  }`}
                >
                  {t === "sale" ? "Credit sale" : "Payment"}
                </button>
              ))}
            </div>

            {txnType === "payment" && (
              <div className="grid grid-cols-2 gap-2 mb-4 animate-in fade-in duration-150">
                {(
                  [
                    ["full", "Full payment"],
                    ["partial", "Partial payment"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => {
                      setPayKind(k);
                      if (k === "full")
                        setForm((f) => ({
                          ...f,
                          amount: String(Math.max(balanceOf(selected), 0)),
                        }));
                    }}
                    className={`rounded py-2 text-[13px] font-semibold border transition-colors ${
                      payKind === k
                        ? "border-paid text-paid bg-paper-raised"
                        : "border-line text-ink-soft bg-paper-raised"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <Field label="AMOUNT (₦)">
              <input
                value={form.amount}
                onChange={(e) =>
                  setForm({ ...form, amount: e.target.value.replace(/[^0-9.]/g, "") })
                }
                placeholder="0"
                inputMode="decimal"
                className="input-field mono w-full rounded px-3 py-3 text-2xl font-bold"
              />
            </Field>
            <Field label="NOTE (OPTIONAL)">
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder={txnType === "sale" ? "e.g. 2 bags cement" : "e.g. part payment"}
                className="input-field w-full rounded px-3 py-2.5 text-sm"
              />
            </Field>

            <p className="text-[11px] text-ink-soft mb-5">
              Current balance {naira(Math.max(balanceOf(selected), 0))} · balances recalculate
              automatically.
            </p>

            <button
              onClick={screen === "editTxn" ? saveTxnEdit : addTxn}
              disabled={!parseFloat(form.amount)}
              className="btn-primary w-full rounded py-3 text-sm font-semibold disabled:opacity-40 transition-transform active:scale-[0.99]"
            >
              {screen === "editTxn" ? "Save changes" : "Save entry"}
            </button>

            {screen === "editTxn" && editingTxnId && (
              <div className="perforated rounded mt-6 p-4">
                {confirmDelete === editingTxnId ? (
                  <div className="animate-in fade-in duration-150">
                    <p className="text-sm text-ink">Delete this entry permanently?</p>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="rounded py-2 text-sm font-semibold border border-line bg-paper-raised"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          deleteTxn(editingTxnId);
                          setEditingTxnId(null);
                          resetForm();
                          go("detail");
                        }}
                        className="rounded py-2 text-sm font-semibold bg-destructive text-destructive-foreground"
                      >
                        Yes, delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(editingTxnId)}
                    className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-debt py-1"
                  >
                    <Trash2 size={15} /> Delete entry
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== DETAIL ===== */}
        {screen === "detail" && selected && (
          <div className="animate-in fade-in duration-200">
            <header className="px-5 pt-9 pb-6 border-b border-line bg-paper-raised">
              <div className="flex items-center gap-3">
                <button onClick={() => go("list")} aria-label="Back">
                  <ArrowLeft size={20} />
                </button>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-lg leading-tight truncate">{selected.name}</h2>
                  <p className="mono text-[11px] text-ink-soft mt-0.5">{selected.phone}</p>
                </div>
                <button
                  onClick={() => {
                    setForm({
                      ...emptyForm,
                      name: selected.name,
                      phone: selected.phone,
                      notes: selected.notes,
                    });
                    go("editCustomer");
                  }}
                  aria-label="Edit customer"
                  className="text-ink-soft"
                >
                  <Pencil size={16} />
                </button>
              </div>

              {selected.notes && (
                <p className="mt-4 flex gap-2 text-[12px] text-ink-soft leading-relaxed">
                  <StickyNote size={14} className="shrink-0 mt-0.5" />
                  <span className="whitespace-pre-line">{selected.notes}</span>
                </p>
              )}

              <div className="perforated rounded mt-5 p-4 text-center">
                <p className="mono text-[10px] tracking-widest text-ink-soft">BALANCE</p>
                <p
                  className={`mono text-3xl font-bold mt-1.5 ${
                    balanceOf(selected) > 0 ? "text-debt" : "text-paid"
                  }`}
                >
                  {naira(Math.abs(balanceOf(selected)))}
                </p>
                <p className="text-[11px] text-ink-soft mt-1.5">
                  {balanceOf(selected) > 0
                    ? isOverdue(selected)
                      ? "owed to you · overdue"
                      : "owed to you"
                    : "settled"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  onClick={() => {
                    setTxnType("sale");
                    resetForm();
                    go("addTxn");
                  }}
                  className="btn-primary rounded py-2.5 text-sm font-semibold transition-transform active:scale-[0.98]"
                >
                  + Credit sale
                </button>
                <button
                  onClick={() => {
                    setTxnType("payment");
                    setPayKind("partial");
                    resetForm();
                    go("addTxn");
                  }}
                  className="rounded py-2.5 text-sm font-semibold perforated bg-paper-raised text-paid transition-transform active:scale-[0.98]"
                >
                  + Payment
                </button>
              </div>

              {balanceOf(selected) > 0 && (
                <a
                  href={waLink(selected.phone, reminderMessage(selected, profile))}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-wa mt-2 rounded py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <MessageCircle size={16} /> Send reminder on WhatsApp
                </a>
              )}
              {selected.txns.length > 0 && (
                <a
                  href={waLink(selected.phone, statementMessage(selected, profile))}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 rounded py-2.5 text-sm font-semibold flex items-center justify-center gap-2 border border-line bg-paper-raised text-ink"
                >
                  <Receipt size={15} /> Send statement
                </a>
              )}
            </header>

            <section>
              <p className="mono text-[10px] tracking-widest text-ink-soft px-5 pt-5 pb-2">
                HISTORY
              </p>
              {selected.txns.length === 0 && (
                <div className="px-8 py-12 text-center">
                  <span className="mx-auto h-12 w-12 rounded-full perforated grid place-items-center text-ink-soft">
                    <Receipt size={20} />
                  </span>
                  <p className="text-sm font-semibold mt-4">No entries yet</p>
                  <p className="text-[12px] text-ink-soft mt-1.5">
                    Record a credit sale or a payment to start this customer's ledger.
                  </p>
                </div>
              )}
              {[...selected.txns].reverse().map((t) => (
                <div
                  key={t.id}
                  className="ledger-row flex items-start justify-between px-5 py-3.5 gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {t.type === "sale"
                        ? "Credit sale"
                        : t.kind === "partial"
                          ? "Partial payment"
                          : "Full payment"}
                    </p>
                    <p className="text-[11px] text-ink-soft mt-1 truncate">
                      {fmtDate(t.date)}
                      {t.note ? ` · ${t.note}` : ""}
                    </p>
                    <a
                      href={waLink(selected.phone, receiptMessage(selected, t, profile))}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-semibold text-wa inline-flex items-center gap-1 mt-1.5"
                    >
                      <Receipt size={12} /> Send receipt
                    </a>
                    {confirmDelete === t.id && (
                      <span className="flex items-center gap-2 mt-2 animate-in fade-in duration-150">
                        <button
                          onClick={() => deleteTxn(t.id)}
                          className="rounded px-2.5 py-1 text-[11px] font-semibold bg-destructive text-destructive-foreground"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="rounded px-2.5 py-1 text-[11px] font-semibold border border-line"
                        >
                          Cancel
                        </button>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p
                      className={`mono text-sm font-bold ${
                        t.type === "sale" ? "text-debt" : "text-paid"
                      }`}
                    >
                      {t.type === "sale" ? "+" : "−"}
                      {naira(t.amount)}
                    </p>
                    <button
                      onClick={() => openEditTxn(t)}
                      aria-label="Edit entry"
                      className="text-ink-soft"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(t.id)}
                      aria-label="Delete entry"
                      className="text-ink-soft"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "debt" | "paid" | undefined;
}) {
  return (
    <div className="rounded border border-line bg-paper px-3 py-2.5">
      <p className="text-[10px] tracking-wide text-ink-soft flex items-center gap-1.5">
        {icon} {label}
      </p>
      <p
        className={`mono text-[15px] font-bold mt-1 ${
          tone === "debt" ? "text-debt" : tone === "paid" ? "text-paid" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold border transition-colors ${
        active
          ? "bg-ink text-paper-raised border-ink"
          : "bg-paper-raised text-ink-soft border-line"
      }`}
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="mono text-[11px] tracking-widest text-ink-soft block mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 pt-4 pb-7">
      <button onClick={onClose} aria-label="Close">
        <X size={20} />
      </button>
      <h2 className="font-semibold text-lg truncate">{title}</h2>
    </div>
  );
}
