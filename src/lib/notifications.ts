// Web-only notifications module.
//
// Track Debt is a web app. Device push notifications are not available, so
// reminders live in the in-app notification centre. Scheduling functions
// below compute the same reminders as before and record them as in-app
// notifications; anything that required a native notification channel is a
// graceful no-op.
import { format, addDays, parseISO, startOfDay, setHours, setMinutes, isBefore } from "date-fns";
import type { Customer, BusinessProfile } from "./ledger";
import { naira, balanceOf } from "./ledger";
import { openSales } from "./due-dates";

export type PaymentReminderType =
  | "due_7_days"
  | "due_3_days"
  | "due_1_day"
  | "due_today"
  | "overdue"
  | "daily_record_reminder"
  | "weekly_summary";

export type NotificationSettings = {
  enabled: boolean;
  remind7DaysBefore: boolean;
  remind3DaysBefore: boolean;
  remind1DayBefore: boolean;
  remindOnDueDate: boolean;
  remindOverdue: boolean;
  overdueIntervalDays: number;
  reminderTime: string; // HH:mm format
  // Daily record reminders
  dailyReminderEnabled: boolean;
  dailyReminderTime: string; // HH:mm format
  // Weekly summary
  weeklySummaryEnabled: boolean;
};

export const defaultNotificationSettings: NotificationSettings = {
  enabled: true,
  remind7DaysBefore: false,
  remind3DaysBefore: true,
  remind1DayBefore: true,
  remindOnDueDate: true,
  remindOverdue: true,
  overdueIntervalDays: 3,
  reminderTime: "09:00",
  dailyReminderEnabled: true,
  dailyReminderTime: "19:00",
  weeklySummaryEnabled: true,
};


export type InAppNotification = {
  id: string;
  debtId: string;
  customerId: string;
  type: PaymentReminderType;
  title: string;
  body: string;
  createdAt: string; // ISO
  scheduledFor: string; // ISO
  read: boolean;
  status: "scheduled" | "delivered" | "cancelled";
};

export async function initNotifications() {
  // No native notification channel on the web.
}

type PermissionState = "granted" | "denied" | "prompt";

function browserPermission(): PermissionState | null {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  const p = Notification.permission;
  return p === "default" ? "prompt" : p;
}

export async function checkPermissions(): Promise<PermissionState> {
  return browserPermission() ?? "granted";
}

export async function requestPermissions(): Promise<PermissionState> {
  if (browserPermission() === null) {
    // Browser has no Notification API — in-app reminders still work.
    return "granted";
  }
  const result = await Notification.requestPermission();
  return result === "default" ? "prompt" : result;
}

/** Generates a deterministic integer ID for a scheduled reminder. */
function getDeterministicNotificationId(idBase: string, type: PaymentReminderType, cycleDate?: string): number {
  const str = `${idBase}_${type}${cycleDate ? "_" + cycleDate : ""}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export async function scheduleDailyReminder(
  _customers: Customer[],
  _settings: NotificationSettings
) {
  // Daily record reminders need background delivery, which the web build
  // doesn't have. The in-app notification centre covers due-date reminders.
}

export async function scheduleDebtReminders(
  customer: Customer,
  settings: NotificationSettings,
  _profile: BusinessProfile,
  _inAppNotifs: InAppNotification[],
  setInAppNotifs: (n: InAppNotification[] | ((prev: InAppNotification[]) => InAppNotification[])) => void
) {
  if (!settings.enabled) return;

  const openDebts = openSales(customer);
  const newInAppNotifs: InAppNotification[] = [];

  for (const { txn, outstanding } of openDebts) {
    if (!txn.term?.dueDate) continue;

    const dueDate = parseISO(txn.term.dueDate);
    const [hours, minutes] = settings.reminderTime.split(":").map(Number);
    const now = new Date();

    const addReminder = (date: Date, type: PaymentReminderType, title: string, body: string, cycleDate?: string) => {
      const scheduledDate = setMinutes(setHours(startOfDay(date), hours || 9), minutes || 0);
      if (isBefore(now, scheduledDate)) {
        const id = getDeterministicNotificationId(txn.id, type, cycleDate);
        newInAppNotifs.push({
          id: String(id),
          debtId: txn.id,
          customerId: customer.id,
          type,
          title,
          body,
          createdAt: now.toISOString(),
          scheduledFor: scheduledDate.toISOString(),
          read: false,
          status: "scheduled"
        });
      }
    };

    const amountStr = naira(outstanding);

    if (settings.remind7DaysBefore) {
      addReminder(addDays(dueDate, -7), "due_7_days", "Payment coming up",
        `${customer.name} owes ${amountStr}. Payment is due in 7 days.`);
    }
    if (settings.remind3DaysBefore) {
      addReminder(addDays(dueDate, -3), "due_3_days", "Payment due soon",
        `${customer.name} owes ${amountStr}. Payment is due in 3 days.`);
    }
    if (settings.remind1DayBefore) {
      addReminder(addDays(dueDate, -1), "due_1_day", "Payment due tomorrow",
        `${customer.name} owes ${amountStr}. Payment is due tomorrow.`);
    }
    if (settings.remindOnDueDate) {
      addReminder(dueDate, "due_today", "Payment due today",
        `${customer.name} owes ${amountStr}. Payment is due today.`);
    }
    if (settings.remindOverdue) {
      for (let i = 1; i <= 3; i++) {
        const overdueDate = addDays(dueDate, 1 + (i - 1) * settings.overdueIntervalDays);
        addReminder(overdueDate, "overdue", "Payment overdue",
          `${customer.name}'s ${amountStr} payment is overdue.`,
          format(overdueDate, "yyyy-MM-dd"));
      }
    }
  }

  // Merge new reminders with old, avoiding duplicates by id
  if (newInAppNotifs.length > 0) {
    setInAppNotifs(prev => {
      const filtered = prev.filter(p => !newInAppNotifs.some(n => n.id === p.id));
      return [...newInAppNotifs, ...filtered].slice(0, 100);
    });
  }
}

export async function cancelDebtReminders(_debtId: string) {
  // Nothing to cancel without a native scheduler.
}

export async function reconcileDebtReminders(
  customers: Customer[],
  settings: NotificationSettings,
  profile: BusinessProfile,
  inAppNotifs: InAppNotification[],
  setInAppNotifs: (n: InAppNotification[] | ((prev: InAppNotification[]) => InAppNotification[])) => void
) {
  const activeDebtIds = new Set(
    customers.flatMap(c => openSales(c).map(s => s.txn.id))
  );

  // Clean up in-app notifications for deleted/paid debts
  setInAppNotifs(prev => prev.filter(n => activeDebtIds.has(n.debtId)));

  if (settings.enabled) {
    for (const customer of customers) {
      if (balanceOf(customer) > 0) {
        await scheduleDebtReminders(customer, settings, profile, inAppNotifs, setInAppNotifs);
      }
    }
  }
}

export async function addInAppNotification(
  _notifications: InAppNotification[],
  setNotifications: (n: InAppNotification[] | ((prev: InAppNotification[]) => InAppNotification[])) => void,
  newNotif: Omit<InAppNotification, "id" | "createdAt" | "read" | "status">
) {
  const notif: InAppNotification = {
    ...newNotif,
    id: "n" + Date.now(),
    createdAt: new Date().toISOString(),
    read: false,
    status: "delivered",
  };
  setNotifications(prev => [notif, ...prev].slice(0, 50));
}

/** Kept for API compatibility; no notification taps exist on the web. */
export type NotificationAction = {
  notification: { extra?: { debtId?: string; customerId?: string; type?: PaymentReminderType } };
};

export function setupNotificationListeners(
  _onAction: (action: NotificationAction) => void
) {
  // No-op on the web.
}

export async function scheduleWeeklySummary(
  _customers: Customer[],
  _settings: NotificationSettings
) {
  // Weekly summaries need background delivery; not available on the web.
}
