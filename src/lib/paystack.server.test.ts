import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { isValidPlusCharge, verifyPaystackSignature } from "./paystack.server";

describe("Paystack validation", () => {
  it("accepts only a successful NGN 1,000 charge", () => {
    expect(isValidPlusCharge({ status: "success", amount: 100000, currency: "NGN" })).toBe(true);
    expect(isValidPlusCharge({ status: "success", amount: 99900, currency: "NGN" })).toBe(false);
    expect(isValidPlusCharge({ status: "success", amount: 100000, currency: "USD" })).toBe(false);
  });

  it("verifies the Paystack HMAC signature", () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "test-secret");
    const body = JSON.stringify({ event: "charge.success" });
    const signature = createHmac("sha512", "test-secret").update(body).digest("hex");
    expect(verifyPaystackSignature(body, signature)).toBe(true);
    expect(verifyPaystackSignature(body, `${signature.slice(0, -1)}0`)).toBe(false);
    vi.unstubAllEnvs();
  });
});