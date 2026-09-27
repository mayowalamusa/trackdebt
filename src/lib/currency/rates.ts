import type { CurrencyCode } from "./currencies";

type CachedRate = { rate: number; fetchedAt: string; from: CurrencyCode; to: CurrencyCode };
const CACHE_PREFIX = "trackdebt.v4.fx.";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function getExchangeRate(from: CurrencyCode, to: CurrencyCode): Promise<CachedRate> {
  if (from === to) return { rate: 1, fetchedAt: new Date().toISOString(), from, to };

  const key = `${CACHE_PREFIX}${from}_${to}`;
  try {
    const cached = JSON.parse(window.localStorage.getItem(key) ?? "null") as CachedRate | null;
    if (cached && cached.rate > 0 && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS) {
      return cached;
    }
  } catch {
    // Ignore a corrupt cache and fetch a fresh rate.
  }

  const response = await fetch(`/api/fx/rate?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  if (!response.ok) throw new Error("Exchange rate unavailable.");
  const data = (await response.json()) as { rate?: number; date?: string };
  if (!data.rate || !Number.isFinite(data.rate) || data.rate <= 0) throw new Error("Invalid exchange rate.");

  const result: CachedRate = {
    rate: data.rate,
    fetchedAt: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
    from,
    to,
  };
  try { window.localStorage.setItem(key, JSON.stringify(result)); } catch { /* cache is optional */ }
  return result;
}

export async function convertMoney(amount: number, from: CurrencyCode, to: CurrencyCode) {
  const { rate } = await getExchangeRate(from, to);
  return Math.round(amount * rate * 100) / 100;
}
