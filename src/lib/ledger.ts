export type Txn = {
  id: string;
  type: "sale" | "payment";
  amount: number;
  date: string;
  note: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
  txns: Txn[];
};

export const OVERDUE_DAYS = 14;

export const naira = (n: number) => "₦" + Math.round(n).toLocaleString("en-NG");

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const daysSince = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });

export const balanceOf = (c: Customer) =>
  c.txns.reduce((sum, t) => sum + (t.type === "sale" ? t.amount : -t.amount), 0);

export const lastActivity = (c: Customer) =>
  c.txns.length ? c.txns[c.txns.length - 1].date : c.createdAt;

export const waPhone = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return "234" + digits.slice(1);
  return "234" + digits;
};

export const waLink = (phone: string, text: string) =>
  `https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(text)}`;

export const seed: Customer[] = [
  {
    id: "c1",
    name: "Mama Ngozi",
    phone: "08031234567",
    createdAt: "2026-06-01",
    txns: [
      { id: "t1", type: "sale", amount: 45000, date: "2026-06-02", note: "2 bags rice" },
      { id: "t2", type: "payment", amount: 20000, date: "2026-06-10", note: "" },
      { id: "t3", type: "sale", amount: 12000, date: "2026-07-15", note: "Cooking oil" },
    ],
  },
  {
    id: "c2",
    name: "Emeka Auto Parts",
    phone: "08025551234",
    createdAt: "2026-05-20",
    txns: [
      { id: "t4", type: "sale", amount: 130000, date: "2026-05-22", note: "Brake pads x10" },
      { id: "t5", type: "payment", amount: 130000, date: "2026-06-01", note: "" },
    ],
  },
  {
    id: "c3",
    name: "Blessing Salon",
    phone: "07098765432",
    createdAt: "2026-04-10",
    txns: [{ id: "t6", type: "sale", amount: 8500, date: "2026-04-11", note: "Hair products" }],
  },
];
