/**
 * Phone number utilities.
 *
 * Track Debt stores whatever the user types (lightly cleaned up), but
 * WhatsApp links need a specific digits-only, country-code-prefixed
 * format. These two needs are deliberately kept separate:
 *
 *   normalizeForStorage  — what gets saved on the customer record
 *   normalizeForWhatsApp — what gets used to build a wa.me link
 *
 * The previous implementation (`waPhone` in ledger.ts) assumed any number
 * that didn't already start with "0" or "234" was Nigerian and blindly
 * prepended "234" to it — silently corrupting every international number
 * that didn't happen to start with a 0. This file replaces that.
 */

/** Strip everything except digits and a single leading +. */
function digitsAndLeadingPlus(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

/** What gets saved on the customer record. Cleans up stray spacing and
 *  punctuation while preserving the shape the user typed (local vs
 *  international) — deliberately does NOT force everything into one
 *  format, since we can't always tell a Nigerian local number from a
 *  short international one just by digit count. */
export function normalizeForStorage(raw: string): string {
  const cleaned = digitsAndLeadingPlus(raw);
  return cleaned;
}

/** What a wa.me link needs: digits only, with a country code, no
 *  leading +/00. */
export function normalizeForWhatsApp(raw: string): string {
  const cleaned = digitsAndLeadingPlus(raw);
  const digits = cleaned.replace(/^\+/, "");

  // Already has Nigeria's country code.
  if (digits.startsWith("234")) return digits;

  // Nigerian local mobile format: 0 + 10 digits (e.g. 08012345678).
  // This is the one case we can identify with real confidence, since
  // Nigerian mobile numbers are always exactly 11 digits starting with 0.
  if (/^0\d{10}$/.test(digits)) return "234" + digits.slice(1);

  // Typed with an explicit + (international format) — the + is the
  // signal that a country code is already present, so just strip it.
  if (cleaned.startsWith("+")) return digits;

  // Dialed with the "00" international prefix some countries use.
  if (digits.startsWith("00")) return digits.slice(2);

  // Anything else: no confident signal either way. Return the digits
  // as typed rather than guessing a country code — a wrong link the
  // user can still see and fix beats one that's silently mangled.
  return digits;
}

/** Lenient sanity check — enough to catch obviously-wrong input
 *  (empty, a handful of digits, a phone-shaped wall of repeated digits),
 *  not a full phone-number-format validator. E.164 numbers max out at
 *  15 digits; we allow down to 7 to avoid rejecting valid shorter
 *  local formats we don't specifically recognize. */
export function isProbablyValidPhone(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  if (/^(\d)\1+$/.test(digits)) return false; // e.g. "0000000000"
  return true;
}
