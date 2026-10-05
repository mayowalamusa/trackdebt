import { describe, expect, it } from "vitest";
import {
  balanceOf,
  canAddActiveCustomer,
  countActiveCustomers,
  isActiveCustomer,
  todayISO,
  type Customer,
  type Txn,
} from "@/lib/ledger";
import { openSales } from "@/lib/due-dates";
import { COMPARISON, FREE_ACTIVE_CUSTOMER_LIMIT, PLAN_LIMITS } from "./app-config";
import { getEntitlements } from "./subscription";

const customer = (txns: Txn[]): Customer => ({
  id: "c1",
  name: "Ada",
  phone: "08012345678",
  notes: "",
  createdAt: "2026-01-01",
  txns,
});

const sale = (id: string, amount: number, date: string, dueDate?: string): Txn => ({
  id,
  type: "sale",
  amount,
  date,
  note: "",
  ...(dueDate ? { term: { key: "custom" as const, dueDate } } : {}),
});

const payment = (id: string, amount: number, date: string): Txn => ({
  id,
  type: "payment",
  amount,
  date,
  note: "",
});

describe("balanceOf", () => {
  it("is zero with no transactions", () => {
    expect(balanceOf(customer([]))).toBe(0);
  });

  it("counts a new credit sale as debt", () => {
    expect(balanceOf(customer([sale("t1", 50000, "2026-01-02")]))).toBe(50000);
  });

  it("subtracts a partial payment", () => {
    const c = customer([sale("t1", 50000, "2026-01-02"), payment("t2", 20000, "2026-01-03")]);
    expect(balanceOf(c)).toBe(30000);
  });

  it("reaches zero after the final payment", () => {
    const c = customer([
      sale("t1", 50000, "2026-01-02"),
      payment("t2", 20000, "2026-01-03"),
      payment("t3", 30000, "2026-01-04"),
    ]);
    expect(balanceOf(c)).toBe(0);
  });

  it("handles multiple sales and multiple payments", () => {
    const c = customer([
      sale("t1", 10000, "2026-01-02"),
      sale("t2", 15000, "2026-01-05"),
      payment("t3", 5000, "2026-01-06"),
      payment("t4", 5000, "2026-01-07"),
    ]);
    expect(balanceOf(c)).toBe(15000);
  });

  it("can go negative when the customer overpays (credit in hand)", () => {
    const c = customer([sale("t1", 1000, "2026-01-02"), payment("t2", 1500, "2026-01-03")]);
    expect(balanceOf(c)).toBe(-500);
  });
});

describe("openSales (FIFO allocation)", () => {
  it("returns every sale when nothing has been paid", () => {
    const c = customer([sale("t1", 1000, "2026-01-02"), sale("t2", 2000, "2026-01-03")]);
    expect(openSales(c).map((s) => [s.txn.id, s.outstanding])).toEqual([
      ["t1", 1000],
      ["t2", 2000],
    ]);
  });

  it("settles the oldest sale first", () => {
    const c = customer([
      sale("t1", 1000, "2026-01-02"),
      sale("t2", 2000, "2026-01-03"),
      payment("p1", 1000, "2026-01-04"),
    ]);
    expect(openSales(c).map((s) => [s.txn.id, s.outstanding])).toEqual([["t2", 2000]]);
  });

  it("leaves the partially-paid sale with only its remainder open", () => {
    const c = customer([
      sale("t1", 1000, "2026-01-02"),
      sale("t2", 2000, "2026-01-03"),
      payment("p1", 1500, "2026-01-04"),
    ]);
    expect(openSales(c).map((s) => [s.txn.id, s.outstanding])).toEqual([["t2", 1500]]);
  });

  it("orders by date, not by insertion order", () => {
    const c = customer([
      sale("late", 500, "2026-02-01"),
      sale("early", 700, "2026-01-01"),
      payment("p1", 700, "2026-02-02"),
    ]);
    expect(openSales(c).map((s) => s.txn.id)).toEqual(["late"]);
  });

  it("returns nothing when everything is paid off", () => {
    const c = customer([sale("t1", 1000, todayISO()), payment("p1", 1000, todayISO())]);
    expect(openSales(c)).toEqual([]);
  });
});


describe("active customer limit", () => {
  const make = (n: number, archived = 0) => [
    ...Array.from({ length: n }, () => ({})),
    ...Array.from({ length: archived }, () => ({ archivedAt: "2026-10-01T00:00:00Z" })),
  ];
  it("treats archived customers as inactive", () => {
    expect(isActiveCustomer({})).toBe(true);
    expect(isActiveCustomer({ archivedAt: "2026-10-01" })).toBe(false);
    expect(countActiveCustomers(make(3, 5))).toBe(3);
  });
  it("allows the 20th but blocks the 21st on Free", () => {
    expect(canAddActiveCustomer(make(19), 20)).toBe(true);
    expect(canAddActiveCustomer(make(20), 20)).toBe(false);
    expect(canAddActiveCustomer(make(25), 20)).toBe(false);
  });
  it("does not count archived customers toward the limit", () => {
    expect(canAddActiveCustomer(make(19, 30), 20)).toBe(true);
  });
  it("is unlimited when the limit is null", () => {
    expect(canAddActiveCustomer(make(500), null)).toBe(true);
  });
  it("plan config: Free 20, Plus and Premium unlimited", () => {
    expect(FREE_ACTIVE_CUSTOMER_LIMIT).toBe(20);
    expect(PLAN_LIMITS.free.maxActiveCustomers).toBe(20);
    expect(getEntitlements("free").maxActiveCustomers).toBe(20);
    expect(getEntitlements("plus").maxActiveCustomers).toBeNull();
    expect(getEntitlements("premium").maxActiveCustomers).toBeNull();
  });
  it("shows the limit in the comparison table", () => {
    const row = COMPARISON.find((r) => r.feature === "Active customers");
    expect(row).toMatchObject({ free: "Up to 20", plus: "Unlimited", premium: "Unlimited" });
  });
});
