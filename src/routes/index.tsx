import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Plus, MessageCircle, Search, X, Pencil, Check } from "lucide-react";
import {
  OVERDUE_DAYS,
  balanceOf,
  daysSince,
  fmtDate,
  lastActivity,
  naira,
  seed,
  todayISO,
  waLink,
  type Customer,
  type Txn,
} from "@/lib/ledger";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Debt Book — Track Customer Credit in Naira" },
      {
        name: "description",
        content:
          "A simple ledger for small businesses: record credit sales and payments, see who owes you, and send WhatsApp reminders.",
      },
      { property: "og:title", content: "Debt Book — Track Customer Credit in Naira" },
      {
        property: "og:description",
        content:
          "Record credit sales and payments, see outstanding balances, and nudge customers on WhatsApp.",
      },
    ],
  }),
  component: DebtTracker,
});

type Screen = "list" | "detail" | "addCustomer" | "addTxn";

function DebtTracker() {
  const [businessName, setBusinessName] = useState("Amaka Provisions");
  const [editingName, setEditingName] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>(seed);
  const [screen, setScreen] = useState<Screen>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [txnType, setTxnType] = useState<Txn["type"]>("sale");
  const [form, setForm] = useState({ name: "", phone: "", amount: "", note: "" });

  const selected = customers.find((c) => c.id === selectedId);
  const totalOwed = customers.reduce((s, c) => s + Math.max(balanceOf(c), 0), 0);

  const filtered = customers
    .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => balanceOf(b) - balanceOf(a));

  const resetForm = () => setForm({ name: "", phone: "", amount: "", note: "" });

  const addCustomer = () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    setCustomers((cs) => [
      ...cs,
      {
        id: "c" + Date.now(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        createdAt: todayISO(),
        txns: [],
      },
    ]);
    resetForm();
    setScreen("list");
  };

  const addTxn = () => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0 || !selectedId) return;
    const t: Txn = {
      id: "t" + Date.now(),
      type: txnType,
      amount: amt,
      date: todayISO(),
      note: form.note.trim(),
    };
    setCustomers((cs) =>
      cs.map((c) => (c.id === selectedId ? { ...c, txns: [...c.txns, t] } : c)),
    );
    resetForm();
    setScreen("detail");
  };

  return (
    <main className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-paper relative pb-28 shadow-sm">
        {/* ===== LIST ===== */}
        {screen === "list" && (
          <>
            <header className="px-4 pt-8 pb-5 border-b border-line bg-paper-raised">
              <div className="flex items-center gap-2">
                {editingName ? (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      autoFocus
                      className="input-field mono flex-1 px-2 py-1 text-sm rounded"
                    />
                    <button
                      onClick={() => setEditingName(false)}
                      aria-label="Save business name"
                      className="text-paid"
                    >
                      <Check size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="mono text-xs tracking-[0.18em] text-ink-soft font-semibold">
                      {businessName.toUpperCase()}
                    </h1>
                    <button
                      onClick={() => setEditingName(true)}
                      aria-label="Edit business name"
                      className="text-ink-soft"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                )}
              </div>

              <p className="mono text-4xl font-bold text-debt mt-4">{naira(totalOwed)}</p>
              <p className="text-xs text-ink-soft mt-1">
                total outstanding across {customers.length} customers
              </p>
            </header>

            <div className="px-4 py-3 border-b border-line">
              <div className="flex items-center gap-2 input-field rounded px-3 py-2">
                <Search size={15} className="text-ink-soft" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search customer"
                  className="bg-transparent w-full text-sm outline-none text-ink"
                />
              </div>
            </div>

            <section>
              {filtered.length === 0 && (
                <p className="px-4 py-10 text-center text-sm text-ink-soft">
                  No customers yet. Tap + to add one.
                </p>
              )}
              {filtered.map((c) => {
                const bal = balanceOf(c);
                const overdue = bal > 0 && daysSince(lastActivity(c)) > OVERDUE_DAYS;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedId(c.id);
                      setScreen("detail");
                    }}
                    className="ledger-row w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[15px] text-ink truncate">{c.name}</p>
                      <p className="text-[11px] text-ink-soft mt-0.5 flex items-center gap-2">
                        <span>last activity {fmtDate(lastActivity(c))}</span>
                        {overdue && <span className="stamp text-debt">overdue</span>}
                      </p>
                    </div>
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

            <button
              onClick={() => setScreen("addCustomer")}
              aria-label="Add customer"
              className="btn-primary rounded-full flex items-center justify-center shadow-lg fixed bottom-6 h-14 w-14 right-[max(1.25rem,calc(50%-215px+1.25rem))]"
            >
              <Plus size={24} />
            </button>
          </>
        )}

        {/* ===== ADD CUSTOMER ===== */}
        {screen === "addCustomer" && (
          <div className="p-4">
            <div className="flex items-center gap-3 pt-4 pb-6">
              <button
                onClick={() => {
                  resetForm();
                  setScreen("list");
                }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
              <h2 className="font-semibold text-lg">New customer</h2>
            </div>

            <label className="mono text-[11px] tracking-widest text-ink-soft">NAME</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Chidi Electronics"
              className="input-field w-full rounded px-3 py-2.5 mt-1 mb-4 text-sm"
            />

            <label className="mono text-[11px] tracking-widest text-ink-soft">
              WHATSAPP NUMBER
            </label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="080..."
              inputMode="tel"
              className="input-field w-full rounded px-3 py-2.5 mt-1 mb-6 text-sm"
            />

            <button
              onClick={addCustomer}
              className="btn-primary w-full rounded py-3 text-sm font-semibold"
            >
              Save customer
            </button>
          </div>
        )}

        {/* ===== ADD TRANSACTION ===== */}
        {screen === "addTxn" && selected && (
          <div className="p-4">
            <div className="flex items-center gap-3 pt-4 pb-6">
              <button
                onClick={() => {
                  resetForm();
                  setScreen("detail");
                }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
              <h2 className="font-semibold text-lg">{selected.name}</h2>
            </div>

            <div className="flex rounded overflow-hidden border border-line mb-5">
              {(["sale", "payment"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTxnType(t)}
                  className={`flex-1 py-2 text-sm font-semibold ${
                    txnType === t
                      ? "bg-ink text-paper-raised"
                      : "bg-paper-raised text-ink-soft"
                  }`}
                >
                  {t === "sale" ? "Sold on credit" : "Payment received"}
                </button>
              ))}
            </div>

            <label className="mono text-[11px] tracking-widest text-ink-soft">AMOUNT (₦)</label>
            <input
              value={form.amount}
              onChange={(e) =>
                setForm({ ...form, amount: e.target.value.replace(/[^0-9.]/g, "") })
              }
              placeholder="0"
              inputMode="decimal"
              className="input-field mono w-full rounded px-3 py-3 mt-1 mb-4 text-2xl font-bold"
            />

            <label className="mono text-[11px] tracking-widest text-ink-soft">
              NOTE (OPTIONAL)
            </label>
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder={txnType === "sale" ? "e.g. 2 bags cement" : "e.g. part payment"}
              className="input-field w-full rounded px-3 py-2.5 mt-1 mb-6 text-sm"
            />

            <button
              onClick={addTxn}
              className="btn-primary w-full rounded py-3 text-sm font-semibold"
            >
              Save {txnType === "sale" ? "sale" : "payment"}
            </button>
          </div>
        )}

        {/* ===== DETAIL ===== */}
        {screen === "detail" && selected && (
          <>
            <header className="px-4 pt-8 pb-5 border-b border-line bg-paper-raised">
              <div className="flex items-center gap-3">
                <button onClick={() => setScreen("list")} aria-label="Back">
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h2 className="font-semibold text-lg leading-tight">{selected.name}</h2>
                  <p className="mono text-[11px] text-ink-soft">{selected.phone}</p>
                </div>
              </div>

              <div className="perforated rounded mt-5 p-4 text-center">
                <p className="mono text-[10px] tracking-widest text-ink-soft">BALANCE</p>
                <p
                  className={`mono text-3xl font-bold mt-1 ${
                    balanceOf(selected) > 0 ? "text-debt" : "text-paid"
                  }`}
                >
                  {naira(Math.abs(balanceOf(selected)))}
                </p>
                <p className="text-[11px] text-ink-soft mt-1">
                  {balanceOf(selected) > 0 ? "owed to you" : "settled"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  onClick={() => {
                    setTxnType("sale");
                    setScreen("addTxn");
                  }}
                  className="btn-primary rounded py-2.5 text-sm font-semibold"
                >
                  + Record sale
                </button>
                <button
                  onClick={() => {
                    setTxnType("payment");
                    setScreen("addTxn");
                  }}
                  className="rounded py-2.5 text-sm font-semibold perforated bg-paper-raised text-paid"
                >
                  + Record payment
                </button>
              </div>

              {balanceOf(selected) > 0 && (
                <a
                  href={waLink(
                    selected.phone,
                    `Hello ${selected.name}, this is a friendly reminder that your balance with ${businessName} is ${naira(
                      balanceOf(selected),
                    )}. Thank you!`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-wa mt-2 rounded py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <MessageCircle size={16} /> Send reminder on WhatsApp
                </a>
              )}
            </header>

            <section>
              <p className="mono text-[10px] tracking-widest text-ink-soft px-4 py-3">HISTORY</p>
              {selected.txns.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-ink-soft">
                  No transactions yet.
                </p>
              )}
              {[...selected.txns].reverse().map((t) => (
                <div
                  key={t.id}
                  className="ledger-row flex items-start justify-between px-4 py-3 gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {t.type === "sale" ? "Sold on credit" : "Payment received"}
                    </p>
                    <p className="text-[11px] text-ink-soft mt-0.5 truncate">
                      {fmtDate(t.date)}
                      {t.note ? ` · ${t.note}` : ""}
                    </p>
                  </div>
                  <p
                    className={`mono text-sm font-bold shrink-0 ${
                      t.type === "sale" ? "text-debt" : "text-paid"
                    }`}
                  >
                    {t.type === "sale" ? "+" : "−"}
                    {naira(t.amount)}
                  </p>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
