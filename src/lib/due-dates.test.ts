import { describe, expect, it } from "vitest";
import { addDaysISO, todayISO, type Customer, type Txn } from "@/lib/ledger";
import { dueInfoOf, isOverdue } from "@/lib/due-dates";

const customer = (txns: Txn[]): Customer => ({
  id: "c1",
  name: "Ada",
  phone: "08012345678",
  notes: "",
  createdAt: "2026-01-01",
  txns,
});

const sale = (id: string, amount: number, dueDate?: string): Txn => ({
  id,
  type: "sale",
  amount,
  date: todayISO(),
  note: "",
  ...(dueDate ? { term: { key: "custom" as const, dueDate } } : {}),
});

const payment = (id: string, amount: number): Txn => ({
  id,
  type: "payment",
  amount,
  date: todayISO(),
  note: "",
});

describe("dueInfoOf", () => {
  it("reports due today", () => {
    const info = dueInfoOf(customer([sale("t1", 5000, addDaysISO(0))]));
    expect(info.status).toBe("today");
    expect(isOverdue(customer([sale("t1", 5000, addDaysISO(0))]))).toBe(false);
  });

  it("reports due tomorrow", () => {
    expect(dueInfoOf(customer([sale("t1", 5000, addDaysISO(1))])).status).toBe("tomorrow");
  });

  it("reports a near-future due date as due soon", () => {
    expect(dueInfoOf(customer([sale("t1", 5000, addDaysISO(3))])).status).toBe("soon");
  });

  it("reports a far-future due date as upcoming", () => {
    expect(dueInfoOf(customer([sale("t1", 5000, addDaysISO(20))])).status).toBe("upcoming");
  });

  it("reports yesterday as overdue by one day", () => {
    const info = dueInfoOf(customer([sale("t1", 5000, addDaysISO(-1))]));
    expect(info.status).toBe("overdue");
    expect(info.days).toBe(-1);
    expect(info.label).toBe("Overdue by 1 day");
  });

  it("reports multiple days overdue", () => {
    const info = dueInfoOf(customer([sale("t1", 5000, addDaysISO(-9))]));
    expect(info.status).toBe("overdue");
    expect(info.label).toBe("Overdue by 9 days");
  });

  it("never marks a fully-paid transaction as overdue", () => {
    const c = customer([sale("t1", 5000, addDaysISO(-30)), payment("p1", 5000)]);
    expect(dueInfoOf(c).status).toBe("settled");
    expect(isOverdue(c)).toBe(false);
  });

  it("still marks a partially-paid overdue sale as overdue", () => {
    const c = customer([sale("t1", 5000, addDaysISO(-2)), payment("p1", 2000)]);
    expect(isOverdue(c)).toBe(true);
  });

  it("moves to the next open sale's due date once the oldest is settled", () => {
    const c = customer([
      sale("t1", 1000, addDaysISO(-10)),
      sale("t2", 2000, addDaysISO(5)),
      payment("p1", 1000),
    ]);
    const info = dueInfoOf(c);
    expect(info.status).toBe("upcoming");
    expect(info.dueDate).toBe(addDaysISO(5));
  });

  it("says no due date when the open sale has no term", () => {
    expect(dueInfoOf(customer([sale("t1", 1000)])).status).toBe("none");
  });
});
