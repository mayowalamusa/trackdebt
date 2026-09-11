import { readJSON } from "./storage";
import { defaultNotificationSettings, type InAppNotification, type NotificationSettings } from "./notifications";
import type { BusinessProfile, Customer } from "./ledger";
import type { ReminderRecord } from "./reminders";
import { emptyProfile } from "./ledger";
import { syncCloudCustomers, syncCloudNotifications, syncCloudPreferences, syncCloudProfile, syncCloudReminders, ensureCloudProfile } from "./cloud-data";

const MIGRATION_PREFIX = "trackdebt.v4.cloudMigration.";
type OnboardingState = { completed: boolean; tips: { addCustomer: boolean; openCustomer: boolean; reminder: boolean } };
const defaultOnboarding: OnboardingState = { completed: false, tips: { addCustomer: false, openCustomer: false, reminder: false } };

export function migrationKey(userId: string) {
  return `${MIGRATION_PREFIX}${userId}`;
}

export function hasCompletedMigration(userId: string): boolean {
  try {
    return window.localStorage.getItem(migrationKey(userId)) === "completed";
  } catch {
    return false;
  }
}

export function hasLocalBusinessData(): boolean {
  try {
    return Boolean(window.localStorage.getItem("debtbook.v2.customers") || window.localStorage.getItem("debtbook.v2.profile"));
  } catch {
    return false;
  }
}

export async function migrateLocalData(userId: string): Promise<void> {
  const profile = readJSON<BusinessProfile>("debtbook.v2.profile", emptyProfile, { validate: (value) => !!value && typeof value === "object" && !Array.isArray(value) }).value;
  const customers = readJSON<Customer[]>("debtbook.v2.customers", [], { validate: Array.isArray }).value;
  const reminders = readJSON<ReminderRecord[]>("trackdebt.v3.reminders", [], { validate: Array.isArray }).value;
  const notificationSettings = readJSON<NotificationSettings>("trackdebt.v3.notification_settings", defaultNotificationSettings).value;
  const notifications = readJSON<InAppNotification[]>("trackdebt.v3.in_app_notifications", [], { validate: Array.isArray }).value;
  const onboarding = readJSON<OnboardingState>("trackdebt.v3.onboarding", defaultOnboarding).value;

  await ensureCloudProfile(profile);
  await syncCloudProfile(profile, onboarding);
  await syncCloudCustomers(customers);
  await syncCloudReminders(reminders);
  await syncCloudPreferences(notificationSettings);
  await syncCloudNotifications(notifications);

  window.localStorage.setItem(migrationKey(userId), "completed");
}