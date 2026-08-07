export type Txn = {
  id: string;
  type: "sale" | "payment";
  /** payments only: whether it cleared the balance at the time */
  kind?: "full" | "partial";
  amount: number;
  date: string;
  note: string;
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
};

export const emptyProfile: BusinessProfile = {
  name: "",
  logo: "",
  phone: "",
  address: "",
  email: "",
  category: "",
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

export const OVERDUE_DAYS = 14;

export const naira = (n: number) => "₦" + Math.round(n).toLocaleString("en-NG");

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const daysSince = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });

export const fmtDateLong = (iso: string) =>
  new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const balanceOf = (c: Customer) =>
  c.txns.reduce((sum, t) => sum + (t.type === "sale" ? t.amount : -t.amount), 0);

export const lastActivity = (c: Customer) =>
  c.txns.length ? c.txns[c.txns.length - 1]!.date : c.createdAt;

export const isOverdue = (c: Customer) =>
  balanceOf(c) > 0 && daysSince(lastActivity(c)) > OVERDUE_DAYS;

export const thisMonth = (iso: string) => iso.slice(0, 7) === todayISO().slice(0, 7);

export const waPhone = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return "234" + digits.slice(1);
  return "234" + digits;
};

export const waLink = (phone: string, text: string) =>
  `https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(text)}`;

const profileFooter = (p: BusinessProfile) =>
  [p.phone, p.email, p.address].filter(Boolean).join(" · ");

export const reminderMessage = (c: Customer, p: BusinessProfile) => {
  const biz = p.name || "us";
  const lines = [
    `Hello ${c.name},`,
    ``,
    `This is a friendly reminder that your outstanding balance with ${biz} is ${naira(
      balanceOf(c),
    )} as at ${fmtDateLong(todayISO())}.`,
    ``,
    `Kindly settle when you can. Thank you!`,
  ];
  const footer = profileFooter(p);
  if (footer) lines.push(``, footer);
  return lines.join("\n");
};

export const receiptMessage = (c: Customer, t: Txn, p: BusinessProfile) => {
  const biz = p.name || "Receipt";
  const lines = [
    `*${biz.toUpperCase()}*`,
    p.category,
    ``,
    `RECEIPT · ${fmtDateLong(t.date)}`,
    `Customer: ${c.name}`,
    `${t.type === "sale" ? "Credit sale" : t.kind === "partial" ? "Part payment" : "Payment"}: ${naira(t.amount)}`,
    t.note ? `Note: ${t.note}` : "",
    `Balance after: ${naira(balanceOf(c))}`,
  ].filter(Boolean);
  const footer = profileFooter(p);
  if (footer) lines.push(``, footer);
  return lines.join("\n");
};

export const statementMessage = (c: Customer, p: BusinessProfile) => {
  const biz = p.name || "Statement";
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
