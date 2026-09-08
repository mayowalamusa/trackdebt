// Server-only entitlement tokens.
//
// Paid state that lives in the browser (localStorage) can always be edited by
// the device owner, so it may drive UI affordances only. Anything that costs
// money on our side (AI generation) must be gated on a token this module
// signed, which the client cannot forge or extend.

import type { PlanId } from "./app-config";

export type EntitlementClaims = {
  plan: Exclude<PlanId, "free">;
  /** Epoch milliseconds. */
  exp: number;
  /** Promo/purchase reference the token was issued for. */
  ref: string;
};

function signingSecret(): string | null {
  return (
    process.env["TRACKDEBT_ENTITLEMENT_SECRET"] ||
    process.env["LOVABLE_API_KEY"] ||
    null
  );
}

const encoder = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return b64url(new Uint8Array(sig));
}

export async function issueEntitlementToken(claims: EntitlementClaims): Promise<string | null> {
  const secret = signingSecret();
  if (!secret) return null;
  const payload = b64url(encoder.encode(JSON.stringify(claims)));
  return `${payload}.${await hmac(payload, secret)}`;
}

/** Returns the claims only when the signature is valid and the token is unexpired. */
export async function verifyEntitlementToken(
  token: unknown,
): Promise<EntitlementClaims | null> {
  const secret = signingSecret();
  if (!secret || typeof token !== "string" || !token.includes(".")) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = await hmac(payload, secret);
  if (expected.length !== signature.length) return null;
  // Constant-length compare over the two signatures.
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  if (diff !== 0) return null;

  try {
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as EntitlementClaims;
    if (claims.plan !== "plus" && claims.plan !== "premium") return null;
    if (typeof claims.exp !== "number" || claims.exp <= Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}
