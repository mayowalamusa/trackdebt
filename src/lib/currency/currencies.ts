export const SUPPORTED_CURRENCIES = [
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", locale: "en-NG" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "₵", locale: "en-GH" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", locale: "en-KE" },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh", locale: "sw-TZ" },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh", locale: "en-UG" },
  { code: "ZMW", name: "Zambian Kwacha", symbol: "K", locale: "en-ZM" },
  { code: "RWF", name: "Rwandan Franc", symbol: "FRw", locale: "rw-RW" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];
export const DEFAULT_CURRENCY: CurrencyCode = "NGN";

export const getCurrency = (code?: string | null) =>
  SUPPORTED_CURRENCIES.find((currency) => currency.code === code) ??
  SUPPORTED_CURRENCIES.find((currency) => currency.code === DEFAULT_CURRENCY)!;

export const isCurrencyCode = (value: unknown): value is CurrencyCode =>
  typeof value === "string" && SUPPORTED_CURRENCIES.some((currency) => currency.code === value);
