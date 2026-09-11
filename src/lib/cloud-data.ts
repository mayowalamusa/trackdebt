import type { BusinessProfile, Customer, Txn } from "./ledger";
import type { ReminderRecord } from "./reminders";
import type { InAppNotification, NotificationSettings } from "./notifications";
import { emptyProfile } from "./ledger";
import { defaultNotificationSettings } from "./notifications";
import { supabase } from "./supabase";

export type CloudSnapshot = {
  profile: BusinessProfile;
  customers: Customer[];
  reminders: ReminderRecord[];
  notificationSettings: NotificationSettings;
  notifications: InAppNotification[];
  onboarding: { completed: boolean; tips: { addCustomer: boolean; openCustomer: boolean; reminder: boolean } };
};

export const cloudAvailable = () => !!supabase;

async function userId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function loadCloudSnapshot(): Promise<CloudSnapshot | null> {
  const id = await userId();
  if (!supabase || !id) return null;

  const [profileResult, customersResult, transactionsResult, remindersResult, preferencesResult, notificationsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("customers").select("*").eq("user_id", id).order("created_at"),
    supabase.from("transactions").select("*").eq("user_id", id).order("transaction_date"),
    supabase.from("reminders").select("*").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("notification_preferences").select("*").eq("user_id", id).maybeSingle(),
    supabase.from("notifications").select("*").eq("user_id", id).order("scheduled_for"),
  ]);
  if (profileResult.error || customersResult.error || transactionsResult.error || remindersResult.error || preferencesResult.error || notificationsResult.error) {
    throw profileResult.error ?? customersResult.error ?? transactionsResult.error ?? remindersResult.error ?? preferencesResult.error ?? notificationsResult.error;
  }

  const profileRow = profileResult.data as Record<string, unknown> | null;
  const profile: BusinessProfile = profileRow ? {
    ...emptyProfile,
    name: String(profileRow["business_name"] ?? ""),
    phone: String(profileRow["business_phone"] ?? ""),
    address: String(profileRow["business_address"] ?? ""),
    email: String(profileRow["business_email"] ?? ""),
    category: String(profileRow["business_category"] ?? ""),
    bankName: String(profileRow["bank_name"] ?? ""),
    accountNumber: String(profileRow["account_number"] ?? ""),
    accountName: String(profileRow["account_name"] ?? ""),
  } : emptyProfile;

  const transactionsByCustomer = new Map<string, Txn[]>();
  for (const row of (transactionsResult.data ?? []) as Record<string, unknown>[]) {
    const list = transactionsByCustomer.get(String(row["customer_id"])) ?? [];
    const transaction: Txn = {
      id: String(row["legacy_id"] ?? row["id"]),
      type: row["type"] as Txn["type"],
      ...(row["kind"] === "full" || row["kind"] === "partial" ? { kind: row["kind"] } : {}),
      amount: Number(row["amount"]),
      date: String(row["transaction_date"]),
      note: String(row["note"] ?? ""),
      ...(row["reference"] ? { reference: String(row["reference"]) } : {}),
      ...(row["due_date"] ? { term: { key: (row["term_key"] ?? "custom") as NonNullable<Txn["term"]>["key"], dueDate: String(row["due_date"]), ...(row["term_set_at"] ? { setAt: String(row["term_set_at"]) } : {}) } } : {}),
    };
    list.push(transaction);
    transactionsByCustomer.set(String(row["customer_id"]), list);
  }

  const customers = ((customersResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row["legacy_id"] ?? row["id"]),
    name: String(row["name"]),
    phone: String(row["phone"]),
    notes: String(row["notes"] ?? ""),
    createdAt: String(row["created_at"]).slice(0, 10),
    txns: transactionsByCustomer.get(String(row["id"])) ?? [],
  }));

  const reminders = ((remindersResult.data ?? []) as Record<string, unknown>[]).map((row): ReminderRecord => {
    const reminder: ReminderRecord = {
    id: String(row["legacy_id"] ?? row["id"]),
    customerId: String(row["customer_id"] ?? ""),
    customerName: String(row["customer_name"] ?? ""),
    ...(row["transaction_id"] ? { txnId: String(row["transaction_id"]) } : {}),
    at: String(row["created_at"]),
    templateId: row["template_id"] as ReminderRecord["templateId"],
    message: String(row["message"]),
    status: row["status"] as ReminderRecord["status"],
    };
    if (row["tone"]) reminder.tone = row["tone"] as NonNullable<ReminderRecord["tone"]>;
    return reminder;
  });

  const preference = preferencesResult.data as Record<string, unknown> | null;
  const notificationSettings: NotificationSettings = preference ? {
    enabled: Boolean(preference["enabled"]),
    remind7DaysBefore: Boolean(preference["remind_7_days_before"]),
    remind3DaysBefore: Boolean(preference["remind_3_days_before"]),
    remind1DayBefore: Boolean(preference["remind_1_day_before"]),
    remindOnDueDate: Boolean(preference["remind_on_due_date"]),
    remindOverdue: Boolean(preference["remind_overdue"]),
    overdueIntervalDays: Number(preference["overdue_interval_days"] ?? 3),
    reminderTime: String(preference["reminder_time"] ?? "09:00"),
    dailyReminderEnabled: Boolean(preference["daily_reminder_enabled"]),
    dailyReminderTime: String(preference["daily_reminder_time"] ?? "19:00"),
    weeklySummaryEnabled: Boolean(preference["weekly_summary_enabled"]),
  } : defaultNotificationSettings;

  const profileTips = profileRow?.["onboarding_tips"] as { addCustomer?: boolean; openCustomer?: boolean; reminder?: boolean } | null;
  return {
    profile,
    customers,
    reminders,
    notificationSettings,
    notifications: ((notificationsResult.data ?? []) as InAppNotification[]),
    onboarding: {
      completed: Boolean(profileRow?.["onboarding_completed"]),
      tips: { addCustomer: Boolean(profileTips?.addCustomer), openCustomer: Boolean(profileTips?.openCustomer), reminder: Boolean(profileTips?.reminder) },
    },
  };
}

export async function ensureCloudProfile(profile?: Partial<BusinessProfile>) {
  const id = await userId();
  if (!supabase || !id) return;
  await supabase.from("profiles").upsert({
    id,
    business_name: profile?.name ?? "",
    business_phone: profile?.phone ?? "",
    business_address: profile?.address ?? "",
    business_email: profile?.email ?? "",
    business_category: profile?.category ?? "",
    bank_name: profile?.bankName ?? "",
    account_number: profile?.accountNumber ?? "",
    account_name: profile?.accountName ?? "",
  }, { onConflict: "id" });
}

export async function syncCloudProfile(profile: BusinessProfile, onboarding?: { completed: boolean; tips: { addCustomer: boolean; openCustomer: boolean; reminder: boolean } }) {
  const id = await userId();
  if (!supabase || !id) return;
  await supabase.from("profiles").upsert({
    id,
    business_name: profile.name,
    business_phone: profile.phone,
    business_address: profile.address,
    business_email: profile.email,
    business_category: profile.category,
    bank_name: profile.bankName,
    account_number: profile.accountNumber,
    account_name: profile.accountName,
    ...(onboarding ? { onboarding_completed: onboarding.completed, onboarding_tips: onboarding.tips } : {}),
  }, { onConflict: "id" });
}

export async function syncCloudCustomers(customers: Customer[]) {
  const id = await userId();
  if (!supabase || !id) return;
  const customerRows = customers.map((customer) => ({ user_id: id, legacy_id: customer.id, name: customer.name, phone: customer.phone, notes: customer.notes, created_at: `${customer.createdAt}T00:00:00Z` }));
  if (customerRows.length) await supabase.from("customers").upsert(customerRows, { onConflict: "user_id,legacy_id" });
  const { data: rows } = await supabase.from("customers").select("id,legacy_id").eq("user_id", id);
  const ids = new Map((rows ?? []).map((row) => [String(row.legacy_id), String(row.id)]));
  const transactionRows = customers.flatMap((customer) => (customer.txns ?? []).map((txn) => ({
    user_id: id,
    customer_id: ids.get(customer.id),
    legacy_id: txn.id,
    type: txn.type,
    kind: txn.kind ?? null,
    amount: txn.amount,
    transaction_date: txn.date,
    note: txn.note,
    reference: txn.reference ?? null,
    term_key: txn.term?.key ?? null,
    due_date: txn.term?.dueDate ?? null,
    term_set_at: txn.term?.setAt ?? null,
  }))).filter((row) => row.customer_id);
  if (transactionRows.length) await supabase.from("transactions").upsert(transactionRows, { onConflict: "user_id,legacy_id" });
}

export async function syncCloudReminders(reminders: ReminderRecord[]) {
  const id = await userId();
  if (!supabase || !id || !reminders.length) return;
  await supabase.from("reminders").upsert(reminders.map((reminder) => ({ user_id: id, legacy_id: reminder.id, customer_id: null, transaction_id: null, customer_name: reminder.customerName, template_id: reminder.templateId, tone: reminder.tone ?? null, message: reminder.message, status: reminder.status, created_at: reminder.at, sent_at: reminder.status === "sent" ? reminder.at : null })), { onConflict: "user_id,legacy_id" });
}

export async function syncCloudPreferences(settings: NotificationSettings) {
  const id = await userId();
  if (!supabase || !id) return;
  await supabase.from("notification_preferences").upsert({ user_id: id, enabled: settings.enabled, remind_7_days_before: settings.remind7DaysBefore, remind_3_days_before: settings.remind3DaysBefore, remind_1_day_before: settings.remind1DayBefore, remind_on_due_date: settings.remindOnDueDate, remind_overdue: settings.remindOverdue, overdue_interval_days: settings.overdueIntervalDays, reminder_time: settings.reminderTime, daily_reminder_enabled: settings.dailyReminderEnabled, daily_reminder_time: settings.dailyReminderTime, weekly_summary_enabled: settings.weeklySummaryEnabled }, { onConflict: "user_id" });
}

export async function syncCloudNotifications(notifications: InAppNotification[]) {
  const id = await userId();
  if (!supabase || !id || !notifications.length) return;
  await supabase.from("notifications").upsert(notifications.map((notification) => ({ user_id: id, legacy_id: notification.id, customer_id: null, transaction_id: null, type: notification.type, title: notification.title, body: notification.body, created_at: notification.createdAt, scheduled_for: notification.scheduledFor, read: notification.read, status: notification.status })), { onConflict: "user_id,legacy_id" });
}

export async function syncCloudOnboarding(onboarding: { completed: boolean; tips: { addCustomer: boolean; openCustomer: boolean; reminder: boolean } }) {
  const id = await userId();
  if (!supabase || !id) return;
  await supabase.from("profiles").update({ onboarding_completed: onboarding.completed, onboarding_tips: onboarding.tips }).eq("id", id);
}

export async function hasCloudMigration(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("migration_batches")
    .select("id")
    .eq("user_id", userId)
    .eq("source", "localStorage")
    .eq("source_version", 1)
    .eq("status", "completed")
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function recordCloudMigration(userId: string, counts: { customers: number; transactions: number; reminders: number }) {
  if (!supabase) throw new Error("Cloud storage is not configured.");
  const { error } = await supabase.from("migration_batches").upsert({
    user_id: userId,
    source: "localStorage",
    source_version: 1,
    status: "completed",
    imported_customers: counts.customers,
    imported_transactions: counts.transactions,
    imported_reminders: counts.reminders,
    completed_at: new Date().toISOString(),
  }, { onConflict: "user_id,source,source_version" });
  if (error) throw error;
}