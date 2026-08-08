import { dueInfoOf, effectiveDueDate, openSales } from "./due-dates";
import {
  APP_NAME,
  balanceOf,
  fmtDateLong,
  naira,
  paymentDetailsLine,
  type BusinessProfile,
  type Customer,
} from "./ledger";

export type Tone = "friendly" | "professional" | "firm";

export type TemplateId =
  "friendly" | "professional" | "firm" | "very-firm" | "final" | "end-of-month" | "vip";

export type ReminderTemplate = {
  id: TemplateId;
  name: string;
  description: string;
  /** "free" templates are always available. "pro" templates are gated in Phase 3. */
  tier: "free" | "pro";
  build: (ctx: ReminderContext) => string;
};

export type ReminderContext = {
  customerName: string;
  businessName: string;
  businessPhone: string;
  outstanding: string;
  originalAmount: string;
  dueDateLong?: string | undefined;
  daysOverdue: number;
  status: "no-due-date" | "not-due" | "due-today" | "overdue";
};

export function buildContext(c: Customer, p: BusinessProfile): ReminderContext {
  const info = dueInfoOf(c);
  const due = effectiveDueDate(c);
  const oldest = openSales(c)[0];
  const status: ReminderContext["status"] =
    info.status === "overdue"
      ? "overdue"
      : info.status === "today"
        ? "due-today"
        : due
          ? "not-due"
          : "no-due-date";

  return {
    customerName: c.name,
    businessName: p.name || APP_NAME,
    businessPhone: p.phone,
    outstanding: naira(Math.max(balanceOf(c), 0)),
    originalAmount: naira(oldest?.txn.amount ?? Math.max(balanceOf(c), 0)),
    dueDateLong: due ? fmtDateLong(due) : undefined,
    daysOverdue: info.days !== undefined && info.days < 0 ? Math.abs(info.days) : 0,
    status,
  };
}

const sign = (ctx: ReminderContext) =>
  ctx.businessPhone ? `${ctx.businessName}\n${ctx.businessPhone}` : ctx.businessName;

/** The standard, free reminder: wording changes with payment status. */
function standard(ctx: ReminderContext): string {
  if (ctx.status === "overdue") {
    return [
      `Hello ${ctx.customerName},`,
      ``,
      `This is a friendly reminder that your outstanding payment of ${ctx.outstanding} was due on ${ctx.dueDateLong} and is now ${ctx.daysOverdue} ${ctx.daysOverdue === 1 ? "day" : "days"} overdue.`,
      ``,
      `Kindly make payment at your earliest convenience.`,
      ``,
      `Thank you,`,
      sign(ctx),
    ].join("\n");
  }
  if (ctx.status === "due-today") {
    return [
      `Hello ${ctx.customerName},`,
      ``,
      `This is a reminder that your payment of ${ctx.outstanding} is due today.`,
      ``,
      `Kindly make payment when convenient.`,
      ``,
      `Thank you,`,
      sign(ctx),
    ].join("\n");
  }
  if (ctx.status === "not-due") {
    return [
      `Hello ${ctx.customerName},`,
      ``,
      `This is a friendly reminder that your payment of ${ctx.outstanding} is due on ${ctx.dueDateLong}.`,
      ``,
      `Thank you for your patronage.`,
      ``,
      sign(ctx),
    ].join("\n");
  }
  return [
    `Hello ${ctx.customerName},`,
    ``,
    `This is a friendly reminder that your outstanding balance is ${ctx.outstanding}.`,
    ``,
    `Kindly settle when you can. Thank you!`,
    ``,
    sign(ctx),
  ].join("\n");
}

const dueClause = (ctx: ReminderContext) =>
  ctx.status === "overdue"
    ? `, which was due on ${ctx.dueDateLong} (${ctx.daysOverdue} ${ctx.daysOverdue === 1 ? "day" : "days"} overdue)`
    : ctx.dueDateLong
      ? `, due on ${ctx.dueDateLong}`
      : "";

export const REMINDER_TEMPLATES: ReminderTemplate[] = [
  {
    id: "friendly",
    name: "Friendly Reminder",
    description: "Warm and polite. Adapts to the payment status.",
    tier: "free",
    build: standard,
  },
  {
    id: "professional",
    name: "Professional Reminder",
    description: "Neutral, business-like wording.",
    tier: "pro",
    build: (ctx) =>
      [
        `Dear ${ctx.customerName},`,
        ``,
        `We wish to bring to your attention an outstanding balance of ${ctx.outstanding}${dueClause(ctx)}.`,
        ``,
        `We would appreciate settlement at your earliest convenience.`,
        ``,
        `Regards,`,
        sign(ctx),
      ].join("\n"),
  },
  {
    id: "firm",
    name: "Firm Reminder",
    description: "Direct, still courteous.",
    tier: "pro",
    build: (ctx) =>
      [
        `Dear ${ctx.customerName},`,
        ``,
        `Your account currently carries an outstanding balance of ${ctx.outstanding}${dueClause(ctx)}.`,
        ``,
        `Kindly arrange payment without further delay.`,
        ``,
        sign(ctx),
      ].join("\n"),
  },
  {
    id: "very-firm",
    name: "Very Firm Reminder",
    description: "For repeatedly missed due dates.",
    tier: "pro",
    build: (ctx) =>
      [
        `Dear ${ctx.customerName},`,
        ``,
        `Despite previous reminders, ${ctx.outstanding} remains unpaid${dueClause(ctx)}.`,
        ``,
        `Please settle this balance immediately to keep your account in good standing.`,
        ``,
        sign(ctx),
      ].join("\n"),
  },
  {
    id: "final",
    name: "Final Reminder",
    description: "Last notice before credit is paused.",
    tier: "pro",
    build: (ctx) =>
      [
        `Dear ${ctx.customerName},`,
        ``,
        `FINAL REMINDER: ${ctx.outstanding} remains outstanding${dueClause(ctx)}.`,
        ``,
        `Kindly settle in full. Further credit will be placed on hold until this balance is cleared.`,
        ``,
        sign(ctx),
      ].join("\n"),
  },
  {
    id: "end-of-month",
    name: "End-of-Month Reminder",
    description: "For customers who settle monthly.",
    tier: "pro",
    build: (ctx) =>
      [
        `Hello ${ctx.customerName},`,
        ``,
        `As we close the month, your outstanding balance stands at ${ctx.outstanding}${dueClause(ctx)}.`,
        ``,
        `Kindly settle before month end so we can balance our books. Thank you!`,
        ``,
        sign(ctx),
      ].join("\n"),
  },
  {
    id: "vip",
    name: "VIP Customer Reminder",
    description: "Extra-courteous tone for valued customers.",
    tier: "pro",
    build: (ctx) =>
      [
        `Hello ${ctx.customerName},`,
        ``,
        `Thank you sincerely for your continued patronage. Just a gentle note that ${ctx.outstanding} is outstanding on your account${dueClause(ctx)}.`,
        ``,
        `Whenever convenient is fine. We appreciate you.`,
        ``,
        sign(ctx),
      ].join("\n"),
  },
];

export const templateById = (id: TemplateId) =>
  REMINDER_TEMPLATES.find((t) => t.id === id) ?? REMINDER_TEMPLATES[0]!;

export const buildReminder = (c: Customer, p: BusinessProfile, id: TemplateId = "friendly") => {
  const base = templateById(id).build(buildContext(c, p));
  const payment = paymentDetailsLine(p);
  return payment ? `${base}\n\n${payment}` : base;
};

/* ---------------- reminder history ---------------- */

export type ReminderStatus = "prepared" | "sent" | "cancelled";

export type ReminderRecord = {
  id: string;
  customerId: string;
  customerName: string;
  txnId?: string;
  at: string; // ISO timestamp
  templateId: TemplateId | "ai";
  tone?: Tone;
  message: string;
  status: ReminderStatus;
};
