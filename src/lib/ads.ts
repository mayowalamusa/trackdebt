import { ADMOB } from "./app-config";

export type AdSlot = "banner" | "native";

export const adUnitId = (slot: AdSlot) => {
  const unit = ADMOB[slot];
  return ADMOB.testMode ? unit.test : unit.production || unit.test;
};

/** Track Debt is a web-only app; there is no native platform. Kept as a
 *  stable seam so ad components render nothing on the web. */
export const isNativePlatform = () => false;

export type AdService = {
  initialize(): Promise<void>;
  showBanner(): Promise<void>;
  hideBanner(): Promise<void>;
  loadNative(): Promise<void>;
};

/** No-op service: the web build has no ad surface. */
export const adService: AdService = {
  async initialize() {},
  async showBanner() {},
  async hideBanner() {},
  async loadNative() {},
};

/** Screens where ads must never appear. */
export const AD_FREE_CONTEXTS = [
  "addTxn",
  "editTxn",
  "addCustomer",
  "editCustomer",
  "reminder",
  "receipt",
] as const;

export type AdContext = string;

export const canShowAdIn = (context: AdContext) =>
  !(AD_FREE_CONTEXTS as readonly string[]).includes(context);
