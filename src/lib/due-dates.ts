import { balanceOf, daysUntil, fmtDateLong, type Customer, type Txn } from "./ledger";

export type DueStatus = "none" | "settled" | "upcoming" | "soon" | "today" | "tomorrow" | "overdue";

export type DueInfo = {
  status: DueStatus;
  /** Due date driving the status, if any. */
  dueDate?: string;
  /** Days until due (negative when overdue). */
  days?: number;
  label: string;
  /** Design token colour name for the badge. */
  tone: "paid" | "warn" | "debt" | "muted";
};

export const DUE_SOON_DAYS = 3;

/** FIFO allocation: payments settle the oldest credit sales first.
 *  Returns the sales that still have an unpaid portion, oldest first. */
export function openSales(c: Customer): { txn: Txn; outstanding: number }[] {
  const sales = c.txns
    .filter((t) => t.type === "sale")
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  let credit = c.txns
    .filter((t) => t.type === "payment")
    .reduce((sum, t) => sum + t.amount, 0);

  const open: { txn: Txn; outstanding: number }[] = [];
  for (const txn of sales) {
    const applied = Math.min(credit, txn.amount);
    credit -= applied;
    const outstanding = txn.amount - applied;
    if (outstanding > 0) open.push({ txn, outstanding });
  }
  return open;
}

/** The due date that governs this customer: the earliest due date among
 *  sales that still have an outstanding portion. */
export function effectiveDueDate(c: Customer): string | undefined {
  const dates = openSales(c)
    .map((s) => s.txn.term?.dueDate)
    .filter((d): d is string => Boolean(d))
    .sort();
  return dates[0];
}

export function dueInfoFromDate(dueDate: string | undefined, hasBalance: boolean): DueInfo {
  if (!hasBalance) return { status: "settled", label: "Settled", tone: "muted" };
  if (!dueDate) return { status: "none", label: "No due date", tone: "muted" };

  const days = daysUntil(dueDate);
  if (days < 0)
    return {
      status: "overdue",
      dueDate,
      days,
      label: `Overdue by ${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"}`,
      tone: "debt",
    };
  if (days === 0) return { status: "today", dueDate, days, label: "Due today", tone: "warn" };
  if (days === 1) return { status: "tomorrow", dueDate, days, label: "Due tomorrow", tone: "warn" };
  if (days <= DUE_SOON_DAYS)
    return { status: "soon", dueDate, days, label: `Due in ${days} days`, tone: "warn" };
  return { status: "upcoming", dueDate, days, label: `Due in ${days} days`, tone: "paid" };
}

export const dueInfoOf = (c: Customer): DueInfo =>
  dueInfoFromDate(effectiveDueDate(c), balanceOf(c) > 0);

export const dueInfoOfTxn = (t: Txn, outstanding: number): DueInfo =>
  dueInfoFromDate(t.term?.dueDate, outstanding > 0);

/** Overdue is driven solely by the due date, never by last activity. */
export const isOverdue = (c: Customer) => dueInfoOf(c).status === "overdue";
export const isDueToday = (c: Customer) => dueInfoOf(c).status === "today";
export const isDueThisWeek = (c: Customer) => {
  const info = dueInfoOf(c);
  return info.days !== undefined && info.days >= 0 && info.days <= 7;
};

export const dueDateLong = (c: Customer) => {
  const d = effectiveDueDate(c);
  return d ? fmtDateLong(d) : "No due date set";
};
