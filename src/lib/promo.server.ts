// Server-only promo code table.
//
// Valid codes must never be part of the browser bundle, otherwise anyone can
// read them out of the shipped JavaScript and unlock paid plans for free.
//
// Codes can be overridden per deployment with the TRACKDEBT_PROMO_CODES
// environment variable, formatted as a comma separated list of
// CODE:plan:days — e.g. "LAUNCH50:plus:30,VIP:premium:90".

import type { PlanId } from "./app-config";

export type PromoDefinition = {
  code: string;
  plan: Exclude<PlanId, "free">;
  days: number;
};

const FALLBACK_CODES: PromoDefinition[] = [
  { code: "PLUS30", plan: "plus", days: 30 },
  { code: "PREMIUM30", plan: "premium", days: 30 },
];

function parseConfigured(raw: string): PromoDefinition[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const [code, plan, days] = entry.split(":").map((part) => part?.trim());
      const parsedDays = Number(days);
      if (!code || (plan !== "plus" && plan !== "premium") || !Number.isFinite(parsedDays)) {
        return [];
      }
      return [{ code: code.toUpperCase(), plan, days: Math.max(1, Math.floor(parsedDays)) }];
    });
}

/** Look up a user-submitted code. Returns null when the code is unknown. */
export function findPromo(input: string): PromoDefinition | null {
  const configured = process.env["TRACKDEBT_PROMO_CODES"];
  const table = configured ? parseConfigured(configured) : FALLBACK_CODES;
  const code = input.trim().toUpperCase();
  return table.find((entry) => entry.code === code) ?? null;
}
