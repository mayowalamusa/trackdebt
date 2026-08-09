/** Analytics abstraction. No provider is connected yet and no personal
 *  information (names, phone numbers, amounts) is ever collected. */

export type AnalyticsEvent =
  | "app_opened"
  | "customer_added"
  | "transaction_created"
  | "payment_recorded"
  | "reminder_prepared"
  | "reminder_sent"
  | "ai_reminder_generated"
  | "receipt_generated"
  | "upgrade_page_viewed"
  | "upgrade_initiated"
  | "subscription_activated"
  | "backup_created"
  | "backup_restored";

type Props = Record<string, string | number | boolean>;

export interface AnalyticsProvider {
  track(event: AnalyticsEvent, props?: Props): void;
}

let provider: AnalyticsProvider | null = null;

export const setAnalyticsProvider = (p: AnalyticsProvider | null) => {
  provider = p;
};

export const track = (event: AnalyticsEvent, props?: Props) => {
  provider?.track(event, props);
};
