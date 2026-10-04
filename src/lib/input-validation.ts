/** Shared input validation and normalization used by forms and their action buttons. */
export function isValidEmail(value: string): boolean {
  return /^[^ \t\r\n@]+@[^ \t\r\n@]+\.[^ \t\r\n@]+$/.test(value.trim());
}

export function isValidSignupPassword(value: string): boolean {
  return value.length >= 6 && /[A-Za-z]/.test(value) && /[0-9]/.test(value);
}

export function isValidPromoCode(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(value.trim());
}

export function normalizePromoCode(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "").toUpperCase().slice(0, 64);
}

export function normalizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot < 0) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).split(".").join("");
}

export function isValidPositiveAmount(value: string): boolean {
  if (!value.trim()) return false;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}
