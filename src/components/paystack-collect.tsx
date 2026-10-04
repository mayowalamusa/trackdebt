import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { currentSession } from "@/lib/subscription-api";
import type { Customer, Txn } from "@/lib/ledger";

async function authed(path: string, init?: RequestInit) {
  const session = await currentSession();
  if (!session) throw new Error("Sign in to use Paystack.");
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, ...(init?.headers ?? {}) },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok || json["ok"] === false) throw new Error(json["error"] ?? "Something went wrong.");
  return json;
}

export async function createPayLink(customer: { id: string; name: string }, amount: number): Promise<string> {
  const r = await authed("/api/paystack/collect/link", {
    method: "POST",
    body: JSON.stringify({ customerId: customer.id, customerName: customer.name, amount }),
  });
  return String(r["url"]);
}

/** Settings block: connect a bank account so pay links settle straight to it. */
export function PaystackBankSetup({ isPlus, businessName }: { isPlus: boolean; businessName: string }) {
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [account, setAccount] = useState<{ bank_name: string; account_number: string; account_name: string } | null>(null);
  const [fee, setFee] = useState<number | null>(null);
  const [bankCode, setBankCode] = useState("");
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!isPlus) return;
    authed("/api/paystack/collect/setup").then((r) => { setAccount(r["account"]); setFee(r["feePercent"]); }).catch(() => {});
    authed("/api/paystack/collect/banks").then((r) => setBanks(r["banks"] ?? [])).catch(() => {});
  }, [isPlus]);

  if (!isPlus) {
    return <p className="text-[11px] text-ink-soft leading-relaxed mb-4">Upgrade to Plus to get paid into your bank account through Paystack. Each payment is recorded for you automatically.</p>;
  }

  const save = async () => {
    setBusy(true);
    try {
      const bank = banks.find((b) => b.code === bankCode);
      const r = await authed("/api/paystack/collect/setup", {
        method: "POST",
        body: JSON.stringify({ businessName: businessName || "Track Debt business", bankCode, bankName: bank?.name ?? "", accountNumber: number.trim() }),
      });
      setAccount({ bank_name: bank?.name ?? "", account_number: number.trim(), account_name: String(r["accountName"]) });
      setEditing(false);
      toast.success(`Connected: ${r["accountName"]}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not connect.");
    } finally { setBusy(false); }
  };

  if (account && !editing) {
    return (
      <div className="rounded border border-line bg-paper-raised p-3 mb-4 text-sm">
        <p className="font-semibold">{account.account_name}</p>
        <p className="text-ink-soft text-xs">{account.bank_name} · {account.account_number}</p>
        {fee !== null && <p className="text-[11px] text-ink-soft mt-1">Track Debt keeps {fee}% of each payment. Paystack's own charge also comes out of the payment.</p>}
        <button onClick={() => setEditing(true)} className="text-xs underline mt-2">Change account</button>
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-2">
      <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className="input-field w-full rounded px-3 py-2.5 text-sm">
        <option value="">Choose your bank</option>
        {banks.map((b) => <option key={b.code + b.name} value={b.code}>{b.name}</option>)}
      </select>
      <input value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="10-digit account number" className="input-field w-full rounded px-3 py-2.5 text-sm mono" />
      <button onClick={save} disabled={busy || !bankCode || number.length !== 10} className="btn-primary w-full rounded py-2.5 text-sm font-semibold disabled:opacity-40">
        {busy ? "Checking…" : "Connect bank account"}
      </button>
      {fee !== null && <p className="text-[11px] text-ink-soft">Track Debt keeps {fee}% of each payment. Paystack's own charge also comes out of the payment.</p>}
    </div>
  );
}

/** Pulls Paystack payments customers made and records them in the ledger. */
export function useCollectedPaymentsSync(enabled: boolean, setCustomers: (fn: (cs: Customer[]) => Customer[]) => void) {
  const running = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const run = async () => {
      if (running.current) return;
      running.current = true;
      try {
        const r = await authed("/api/paystack/collect/pending");
        const payments = (r["payments"] ?? []) as { id: string; customer_ref: string; customer_name: string; amount: number; reference: string; paid_at: string }[];
        if (!payments.length) return;
        const applied: string[] = [];
        setCustomers((cs) => cs.map((c) => {
          const mine = payments.filter((p) => p.customer_ref === c.id && !c.txns.some((t) => t.reference === p.reference));
          if (!mine.length) { if (payments.some((p) => p.customer_ref === c.id)) applied.push(...payments.filter((p) => p.customer_ref === c.id).map((p) => p.id)); return c; }
          const txns: Txn[] = mine.map((p) => ({
            id: "t" + Date.parse(p.paid_at) + p.reference.slice(-4),
            type: "payment", kind: "partial", amount: Number(p.amount), date: p.paid_at.slice(0, 10),
            note: "Paid via Paystack", reference: p.reference, currency: "NGN", originalAmount: Number(p.amount), originalCurrency: "NGN",
          }));
          applied.push(...mine.map((p) => p.id));
          return { ...c, txns: [...c.txns, ...txns] };
        }));
        await new Promise((res) => setTimeout(res, 0));
        if (applied.length) {
          await authed("/api/paystack/collect/pending", { method: "POST", body: JSON.stringify({ ids: applied }) });
          toast.success(applied.length === 1 ? "A Paystack payment was added to your records." : `${applied.length} Paystack payments were added to your records.`);
        }
      } catch { /* offline or signed out */ } finally { running.current = false; }
    };
    void run();
    const timer = setInterval(run, 120_000);
    const onVis = () => { if (document.visibilityState === "visible") void run(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVis); };
  }, [enabled, setCustomers]);
}
