import { describe, expect, it } from "vitest";
import {
  isValidEmail,
  isValidPromoCode,
  isValidPositiveAmount,
  isValidSignupPassword,
  normalizeDecimalInput,
  normalizePromoCode,
} from "./input-validation";

describe("input validation", () => {
  it("accepts common email addresses and rejects malformed ones", () => {
    expect(isValidEmail("mayowa@example.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("two words@example.com")).toBe(false);
  });

  it("enforces the sign-up password minimum and letter/number mix", () => {
    expect(isValidSignupPassword("abc123")).toBe(true);
    expect(isValidSignupPassword("abcdef")).toBe(false);
    expect(isValidSignupPassword("123456")).toBe(false);
    expect(isValidSignupPassword("a1")).toBe(false);
  });

  it("rejects spaces and unsupported characters in promo codes", () => {
    expect(isValidPromoCode("TRACKDEBT2026")).toBe(true);
    expect(isValidPromoCode("TRACK-DEBT_2026")).toBe(true);
    expect(isValidPromoCode("TRACK DEBT")).toBe(false);
    expect(isValidPromoCode("CODE!")).toBe(false);
    expect(normalizePromoCode("track debt 2026")).toBe("TRACKDEBT2026");
  });

  it("accepts only positive numeric amounts", () => {
    expect(isValidPositiveAmount("12")).toBe(true);
    expect(isValidPositiveAmount("12.50")).toBe(true);
    expect(isValidPositiveAmount("0")).toBe(false);
    expect(isValidPositiveAmount("-1")).toBe(false);
    expect(isValidPositiveAmount("1..2")).toBe(false);
  });

  it("normalizes decimal input without accepting letters or multiple decimal points", () => {
    expect(normalizeDecimalInput("12a.5.7")).toBe("12.57");
    expect(normalizeDecimalInput("₦1,250.00")).toBe("1250.00");
  });
});
