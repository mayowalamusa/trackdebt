import { ADMOB } from "./app-config";

export type AdSlot = "banner" | "native";

export const adUnitId = (slot: AdSlot) => {
  const unit = ADMOB[slot];
  return ADMOB.testMode ? unit.test : unit.production || unit.test;
};

/** Track Debt ships to Android through Capacitor; AdMob is a native SDK, not a
 *  web ad tag. On the web there is no ad surface at all, so ad components
 *  render nothing. On device, the native plugin is initialised here. */
export const isNativePlatform = () =>
  typeof window !== "undefined" &&
  Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

export type AdService = {
  initialize(): Promise<void>;
  showBanner(): Promise<void>;
  hideBanner(): Promise<void>;
  loadNative(): Promise<void>;
};

/** No-op service for the web build. Replaced by the Capacitor AdMob plugin
 *  in the native Android build without touching any UI code. */
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
