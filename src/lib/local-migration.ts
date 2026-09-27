import { readJSON } from "./storage";
import { defaultNotificationSettings, type InAppNotification, type NotificationSettings } from "./notifications";
import type { BusinessProfile, Customer } from "./ledger";
import type { ReminderRecord } from "./reminders";
import { emptyProfile } from "./ledger";
import { hasCloudMigration, loadCloudSnapshot, syncCloudCustomers, syncCloudNotifications, syncCloudPreferences, syncCloudProfile, syncCloudReminders, ensureCloudProfile, recordCloudMigration } from "./cloud-data";
import { activateCloudStorage, deactivateCloudStorage } from "./storage-mode";

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

export function clearLocalTrackDebtData(): void {
  const keys = [
    "debtbook.v2.customers",
    "debtbook.v2.profile",
    "trackdebt.v3.reminders",
    "trackdebt.v3.notification_settings",
    "trackdebt.v3.in_app_notifications",
    "trackdebt.v3.onboarding",
    "trackdebt.v3.subscription",
    "trackdebt.v3.promo",
    "trackdebt.v3.receiptCounter",
    "trackdebt.v3.lastBackupAt",
    "trackdebt.v3.notificationRecords",
  ];
  for (const key of keys) {
    try {
      window.localStorage.removeItem(key);
      window.localStorage.removeItem(key + ".corrupt");
    } catch {
      /* continue clearing the remaining keys */
    }
  }
}

export function activateCloudOnlyStorage(userId: string): void {
  activateCloudStorage(userId);
}

export function wipeLocalDataAndActivateCloud(userId: string): void {
  clearLocalTrackDebtData();
  window.localStorage.setItem(migrationKey(userId), "completed");
  activateCloudStorage(userId);
}

export async function migrateLocalData(userId: string): Promise<void> {
  if (hasCompletedMigration(userId)) {
    activateCloudStorage(userId);
    return;
  }
  if (await hasCloudMigration(userId)) {
    clearLocalTrackDebtData();
    window.localStorage.setItem(migrationKey(userId), "completed");
    activateCloudStorage(userId);
    return;
  }
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
  const verified = await loadCloudSnapshot();
  if (!verified) throw new Error("Could not verify your cloud data after migration.");
  const localTransactions = customers.reduce((count, customer) => count + customer.txns.length, 0);
  const cloudTransactions = verified.customers.reduce((count, customer) => count + customer.txns.length, 0);
  if (verified.customers.length < customers.length || cloudTransactions < localTransactions || verified.reminders.length < reminders.length) {
    throw new Error("Cloud migration could not be verified. Your local data is still safe.");
  }

  await recordCloudMigration(userId, {
    customers: customers.length,
    transactions: localTransactions,
    reminders: reminders.length,
  });

  clearLocalTrackDebtData();
  window.localStorage.setItem(migrationKey(userId), "completed");
  activateCloudStorage(userId);
}