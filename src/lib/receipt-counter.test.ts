import { beforeEach, describe, expect, it } from "vitest";
import {
  COUNTER_KEY,
  __resetReceiptCounterMemory,
  formatReference,
  issueReceiptReference,
  parseCounter,
} from "@/lib/receipt-counter";

const YEAR = new Date().getFullYear();

beforeEach(() => {
  window.localStorage.clear();
  __resetReceiptCounterMemory();
});

describe("issueReceiptReference", () => {
  it("starts at 000001 and increments sequentially", () => {
    expect(issueReceiptReference()).toBe(formatReference(YEAR, 1));
    expect(issueReceiptReference()).toBe(formatReference(YEAR, 2));
    expect(issueReceiptReference()).toBe(formatReference(YEAR, 3));
  });

  it("persists the sequence across a reload (fresh in-memory state)", () => {
    issueReceiptReference();
    issueReceiptReference();
    __resetReceiptCounterMemory(); // simulates a page refresh
    expect(issueReceiptReference()).toBe(formatReference(YEAR, 3));
  });

  it("never reuses a number after a transaction is deleted", () => {
    const first = issueReceiptReference();
    const second = issueReceiptReference();
    // "deleting" a transaction does not touch the counter
    const third = issueReceiptReference();
    expect(new Set([first, second, third]).size).toBe(3);
    expect(third).toBe(formatReference(YEAR, 3));
  });

  it("does not collide when another tab writes between read and write", () => {
    issueReceiptReference(); // 1
    // Another tab jumps ahead while this tab is idle.
    window.localStorage.setItem(COUNTER_KEY, JSON.stringify({ year: YEAR, next: 9 }));
    expect(issueReceiptReference()).toBe(formatReference(YEAR, 9));
  });

  it("keeps issuing unique numbers when storage throws", () => {
    const original = window.localStorage.setItem.bind(window.localStorage);
    Object.defineProperty(window.localStorage, "setItem", {
      value: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
      configurable: true,
    });
    const a = issueReceiptReference();
    const b = issueReceiptReference();
    Object.defineProperty(window.localStorage, "setItem", {
      value: original,
      configurable: true,
    });
    expect(a).not.toBe(b);
  });

  it("restarts the sequence in a new year", () => {
    issueReceiptReference();
    issueReceiptReference();
    __resetReceiptCounterMemory();
    const next = new Date();
    next.setFullYear(YEAR + 1);
    expect(issueReceiptReference(next)).toBe(formatReference(YEAR + 1, 1));
  });
});

describe("parseCounter", () => {
  it("falls back to 1 on missing or corrupt data", () => {
    expect(parseCounter(null, YEAR)).toBe(1);
    expect(parseCounter("{{{", YEAR)).toBe(1);
    expect(parseCounter(JSON.stringify({ year: YEAR, next: "x" }), YEAR)).toBe(1);
    expect(parseCounter(JSON.stringify({ year: YEAR - 1, next: 50 }), YEAR)).toBe(1);
  });

  it("reads a valid stored counter", () => {
    expect(parseCounter(JSON.stringify({ year: YEAR, next: 42 }), YEAR)).toBe(42);
  });
});
