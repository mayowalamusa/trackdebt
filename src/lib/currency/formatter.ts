import { DEFAULT_CURRENCY, getCurrency, type CurrencyCode } from "./currencies";

const STORAGE_KEY = "trackdebt.v4.currency";

export function getActiveCurrency(): CurrencyCode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return getCurrency(stored).code;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

export function setActiveCurrency(currency: CurrencyCode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, currency);
  } catch {
    // Currency remains available from the business profile in memory.
  }
}

export function formatMoney(amount: number, currency: CurrencyCode = getActiveCurrency()) {
  const meta = getCurrency(currency);
  return new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency: meta.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}
