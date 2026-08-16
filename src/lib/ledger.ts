import { normalizeForWhatsApp } from "./phone";

export const APP_NAME = "Track Debt";
export const APP_VERSION = "1.0.0";

/** Payment terms attached to a credit sale. Stored per-transaction so that
 *  future features (multiple invoices, credit terms, forecasting, analytics)
 *  can build on the same record without a data migration. */
export type TermKey = "none" | "today" | "d7" | "d14" | "d30" | "custom";

export type PaymentTerm = {
  key: TermKey;
  /** ISO date (yyyy-mm-dd). Absent when key === "none". */
  dueDate?: string;
  /** ISO timestamp for when the term was set. */
  setAt?: string;
};

export type Txn = {
  id: string;
  type: "sale" | "payment";
  /** payments only: whether it cleared the balance at the time */
  kind?: "full" | "partial";
  amount: number;
  date: string;
  note: string;
  /** sales only: payment terms for this credit sale */
  term?: PaymentTerm;
  /** receipt / invoice reference, e.g. TD-2026-000001 */
  reference?: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  notes: string;
  createdAt: string;
  txns: Txn[];
};

export type BusinessProfile = {
  name: string;
  logo: string; // data URL
  phone: string;
  address: string;
  email: string;
  category: string;
  /** Optional — shown on reminders and receipts so customers know where to pay. */
  bankName: string;
  accountNumber: string;
  accountName: string;
};

export const emptyProfile: BusinessProfile = {
  name: "",
  logo: "",
  phone: "",
  address: "",
  email: "",
  category: "",
  bankName: "",
  accountNumber: "",
  accountName: "",
};

export const BUSINESS_CATEGORIES = [
  "Provisions / Supermarket",
  "Building materials",
  "Fashion & tailoring",
  "Electronics",
  "Pharmacy",
  "Food & drinks",
  "Auto parts",
  "Salon & beauty",
  "Services",
  "Other",
];

export const naira = (n: number) => "₦" + Math.round(n).toLocaleString("en-NG");

/** True local calendar date as YYYY-MM-DD.
 *
 *  Deliberately NOT `new Date().toISOString().slice(0, 10)` — that reports
 *  the UTC date, which is a day off from the user's actual local date for
 *  part of every day in any timezone other than UTC+0. For a UTC-5 user at
 *  8pm local time, toISOString() already reports tomorrow's date. Reading
 *  local date components avoids that entirely. */
export const todayLocalISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Back-compat alias used throughout the app. Same local-date-correct
 *  implementation as todayLocalISO — kept as one name so there's a single
 *  source of truth for "what date is it today". */
export const todayISO = todayLocalISO;

export const addDaysISO = (days: number, from = todayISO()) => {
  const d = new Date(from + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const TERM_OPTIONS: { key: TermKey; label: string }[] = [
  { key: "today", label: "Due today" },
  { key: "d7", label: "7 days" },
  { key: "d14", label: "14 days" },
  { key: "d30", label: "30 days" },
  { key: "custom", label: "Custom" },
];

export function termDueDate(key: TermKey, custom: string): string | undefined {
  if (key === "today") return addDaysISO(0);
  if (key === "d7") return addDaysISO(7);
  if (key === "d14") return addDaysISO(14);
  if (key === "d30") return addDaysISO(30);
  if (key === "custom") return custom || undefined;
  return undefined;
}

/** Whole calendar days from `a` to `b` (both YYYY-MM-DD), date-only.
 *  Both sides are parsed at local midnight of that calendar date, so this
 *  is never thrown off by time-of-day. Math.round absorbs the rare
 *  DST edge case where the ms difference isn't an exact multiple of a day
 *  (moot for Nigeria, which doesn't observe DST, but safe everywhere). This
 *  is the single place day-difference math happens — every other date
 *  comparison in the app goes through this or daysSince/daysUntil below. */
export const daysBetween = (a: string, b: string) =>
  Math.round(
    (new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000,
  );

/** Whole days from `iso` until today. Positive = in the past. */
export const daysSince = (iso: string) => daysBetween(iso, todayISO());

/** Whole days from today until `iso`. Negative = overdue. */
export const daysUntil = (iso: string) => -daysSince(iso);

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });

export const fmtDateLong = (iso: string) =>
  new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const balanceOf = (c: Customer) =>
  c.txns.reduce((sum, t) => sum + (t.type === "sale" ? t.amount : -t.amount), 0);

export const lastActivity = (c: Customer) =>
  c.txns.length ? c.txns[c.txns.length - 1]!.date : c.createdAt;

export const thisMonth = (iso: string) => iso.slice(0, 7) === todayISO().slice(0, 7);

export const waLink = (phone: string, text: string) =>
  `https://wa.me/${normalizeForWhatsApp(phone)}?text=${encodeURIComponent(text)}`;

export const profileFooter = (p: BusinessProfile) =>
  [p.phone, p.email, p.address].filter(Boolean).join(" · ");

/** Formatted for WhatsApp: bold label + bank / account number / account name,
 *  omitting whichever parts are blank. Empty string if nothing is set. */
export const paymentDetailsLine = (p: BusinessProfile) => {
  const parts = [p.bankName, p.accountNumber, p.accountName].filter(Boolean);
  if (!parts.length) return "";
  return `*Payment details:* ${parts.join(" · ")}`;
};

export const txnLabel = (t: Txn) =>
  t.type === "sale" ? "Credit sale" : t.kind === "partial" ? "Part payment" : "Full payment";

export const receiptMessage = (c: Customer, t: Txn, p: BusinessProfile) => {
  const biz = p.name || APP_NAME;
  const lines = [
    `*${biz.toUpperCase()}*`,
    p.category,
    ``,
    `RECEIPT ${t.reference ?? ""}`.trim(),
    fmtDateLong(t.date),
    `Customer: ${c.name}`,
    `${txnLabel(t)}: ${naira(t.amount)}`,
    t.note ? `Note: ${t.note}` : "",
    t.term?.dueDate ? `Payment due: ${fmtDateLong(t.term.dueDate)}` : "",
    `Balance after: ${naira(balanceOf(c))}`,
  ].filter(Boolean);
  const footer = profileFooter(p);
  if (footer) lines.push(``, footer);
  return lines.join("\n");
};

export const statementMessage = (c: Customer, p: BusinessProfile) => {
  const biz = p.name || APP_NAME;
  const rows = c.txns.map(
    (t) =>
      `${fmtDate(t.date)}  ${t.type === "sale" ? "+" : "−"}${naira(t.amount)}${
        t.note ? `  (${t.note})` : ""
      }`,
  );
  const lines = [
    `*${biz.toUpperCase()}*`,
    `STATEMENT · ${c.name}`,
    ``,
    ...(rows.length ? rows : ["No transactions yet."]),
    ``,
    `Balance: ${naira(balanceOf(c))}`,
  ];
  const footer = profileFooter(p);
  if (footer) lines.push(``, footer);
  return lines.join("\n");
};
