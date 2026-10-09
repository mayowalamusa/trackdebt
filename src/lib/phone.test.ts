import { describe, expect, it } from "vitest";
import { findCustomerByPhone, normalizeForUniqueness } from "./phone";

describe("normalizeForUniqueness", () => {
  it("ignores spaces and punctuation", () => {
    expect(normalizeForUniqueness("+234 803-123-4567")).toBe("08031234567");
    expect(normalizeForUniqueness("(0803) 123 4567")).toBe("08031234567");
  });

  it("matches Nigerian local and international formats", () => {
    const variants = ["08031234567", "2348031234567", "+234 803 123 4567", "00234 803 123 4567"];
    expect(new Set(variants.map(normalizeForUniqueness)).size).toBe(1);
  });

  it("does not treat incomplete phone numbers as identifiers", () => {
    expect(normalizeForUniqueness("123456")).toBe("");
    expect(normalizeForUniqueness("")).toBe("");
    expect(normalizeForUniqueness("1234567890123456")).toBe("");
  });
});

describe("findCustomerByPhone", () => {
  const customers = [
    { id: "a", name: "Ada", phone: "08031234567" },
    { id: "b", name: "Bola", phone: "08055554444", archivedAt: "2026-01-01" },
  ];

  it("finds an existing customer by normalized phone", () => {
    expect(findCustomerByPhone(customers, "+234 803 123 4567")?.name).toBe("Ada");
  });

  it("includes archived customers in uniqueness checks", () => {
    expect(findCustomerByPhone(customers, "2348055554444")?.name).toBe("Bola");
  });

  it("allows a customer to retain their own phone while editing", () => {
    expect(findCustomerByPhone(customers, "2348031234567", "a")).toBeNull();
  });

  it("does not match the same phone against a different customer id", () => {
    expect(findCustomerByPhone(customers, "08031234567", "b")?.id).toBe("a");
  });
});
