import { describe, expect, it } from "vitest";
import { balanceOf, todayISO, type Customer, type Txn } from "@/lib/ledger";
import { openSales } from "@/lib/due-dates";

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
