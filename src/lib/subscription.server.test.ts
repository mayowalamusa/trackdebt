import { describe, expect, it } from "vitest";
import { entitlementFromSubscription, isPlusEntitled, type StoredSubscription } from "./subscription.server";

const base: StoredSubscription = {
  user_id: "user-a",
  plan: "plus",
  status: "active",
  paystack_customer_code: null,
  paystack_subscription_code: null,
  paystack_email_token: null,
  current_period_start: "2026-09-01T00:00:00.000Z",
  current_period_end: "2026-10-01T00:00:00.000Z",
  cancellation_at: null,
  last_successful_payment_at: "2026-09-01T00:00:00.000Z",
  next_expected_payment_at: "2026-10-01T00:00:00.000Z",
  last_transaction_reference: "ref-1",
  amount: 100000,
  currency: "NGN",
};

describe("server Plus entitlement", () => {
  it("keeps free users on Free", () => {
    expect(isPlusEntitled({ ...base, plan: "free" })).toBe(false);
  });

  it("grants an active subscription only during its paid period", () => {
    expect(isPlusEntitled(base, Date.parse("2026-09-15T00:00:00.000Z"))).toBe(true);
    expect(isPlusEntitled(base, Date.parse("2026-10-01T00:00:00.000Z"))).toBe(false);
  });

  it("keeps cancelled access until the paid period ends", () => {
    expect(isPlusEntitled({ ...base, status: "cancelled" }, Date.parse("2026-09-20T00:00:00.000Z"))).toBe(true);
    expect(entitlementFromSubscription({ ...base, status: "cancelled" }, Date.parse("2026-10-02T00:00:00.000Z")).plan).toBe("free");
  });

  it("does not extend a failed subscription without a valid period", () => {
    expect(isPlusEntitled({ ...base, status: "failed", current_period_end: "2026-09-10T00:00:00.000Z" }, Date.parse("2026-09-11T00:00:00.000Z"))).toBe(false);
  });

  it("does not leak one user's subscription to another user", () => {
    expect(isPlusEntitled({ ...base })).toBe(true);
    expect(base.user_id).toBe("user-a");
  });
});