import { LocalNotifications, type ActionPerformed } from "@capacitor/local-notifications";
import { format, addDays, parseISO, startOfDay, setHours, setMinutes, isBefore, differenceInDays } from "date-fns";
import type { Customer, Txn, BusinessProfile } from "./ledger";
import { naira, todayISO, balanceOf } from "./ledger";
import { effectiveDueDate, openSales } from "./due-dates";

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

const CHANNEL_ID = "payment-reminders";
const CHANNEL_NAME = "Payment Reminders";

export async function initNotifications() {
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: CHANNEL_NAME,
    description: "Reminders about upcoming and overdue customer payments.",
    importance: 4,
    visibility: 1,
    vibration: true,
  });
}

export async function checkPermissions() {
  const status = await LocalNotifications.checkPermissions();
  return status.display;
}

export async function requestPermissions() {
  const status = await LocalNotifications.requestPermissions();
  return status.display;
}

/** Generates a deterministic integer ID for Capacitor notifications.
 *  Capacitor local notifications require a number as ID. */
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

const DAILY_MESSAGES = [
  {
    title: "Any credit buyer today?",
    body: "Note them down. It takes just a few seconds to do that.",
  },
  {
    title: "Don't forget today's credit sales",
    body: "Did anyone buy on credit today? Record it before you forget.",
  },
  {
    title: "Quick debt check",
    body: "Any customer owing you today? Add the record now. It only takes a few seconds.",
  },
  {
    title: "Record it while you remember",
    body: "Sold on credit today? Note the debtor now and keep your records straight.",
  },
  {
    title: "Small reminder 👋",
    body: "Any credit buyer today? Add them to Track Debt before the day ends.",
  },
  {
    title: "Keep today's records complete",
    body: "If anyone bought on credit today, take a few seconds to record it.",
  },
];

export async function scheduleDailyReminder(
  customers: Customer[],
  settings: NotificationSettings
) {
  if (!settings.enabled || !settings.dailyReminderEnabled) {
    // If disabled, cancel any pending daily reminders for today and tomorrow
    const pending = await LocalNotifications.getPending();
    const toCancel = pending.notifications
      .filter(n => n.extra?.type === "daily_record_reminder")
      .map(n => ({ id: n.id }));
    if (toCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: toCancel });
    }
    return;
  }

  const today = todayISO();
  const hasRecordToday = customers.some(c =>
    c.txns.some(t => t.type === "sale" && t.date === today)
  );

  const [hours, minutes] = settings.dailyReminderTime.split(":").map(Number);
  const now = new Date();

  // Determine which day to schedule for
  let targetDate = parseISO(today);
  let scheduledTime = setMinutes(setHours(startOfDay(targetDate), hours || 19), minutes || 0);

  // If user already added a record today, or the time for today has passed, schedule for tomorrow
  if (hasRecordToday || isBefore(scheduledTime, now)) {
    targetDate = addDays(targetDate, 1);
    scheduledTime = setMinutes(setHours(startOfDay(targetDate), hours || 19), minutes || 0);
  }

  const targetDateStr = format(targetDate, "yyyy-MM-dd");
  const notificationId = getDeterministicNotificationId("daily", "daily_record_reminder", targetDateStr);

  // Choose a message based on the day
  const msgIndex = (targetDate.getFullYear() + targetDate.getMonth() + targetDate.getDate()) % DAILY_MESSAGES.length;
  const msg = DAILY_MESSAGES[msgIndex]!;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationId,
        title: msg.title,
        body: msg.body,
        schedule: { at: scheduledTime },
        channelId: CHANNEL_ID,
        smallIcon: "ic_splash_logo",
        actionTypeId: "RECORD_DEBT",
        extra: { type: "daily_record_reminder", date: targetDateStr }
      }
    ]
  });

  console.log(`[TrackDebt Notifications] Scheduled daily reminder for ${targetDateStr} at ${format(scheduledTime, "HH:mm")}`);

  // If we scheduled for tomorrow, make sure today's reminder is cancelled if it was pending
  if (targetDateStr !== today) {
    const todayId = getDeterministicNotificationId("daily", "daily_record_reminder", today);
    await LocalNotifications.cancel({ notifications: [{ id: todayId }] });
  }
}

export async function scheduleDebtReminders(
  customer: Customer,
  settings: NotificationSettings,
  profile: BusinessProfile,
  inAppNotifs: InAppNotification[],
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

    const remindersToSchedule: {
      id: number;
      title: string;
      body: string;
      schedule: { at: Date };
      extra: { debtId: string; customerId: string; type: PaymentReminderType; cycleDate?: string | undefined };
    }[] = [];

    // Helper to add a reminder
    const addReminder = (date: Date, type: PaymentReminderType, title: string, body: string, cycleDate?: string) => {
      const scheduledDate = setMinutes(setHours(startOfDay(date), hours || 9), minutes || 0);
      if (isBefore(now, scheduledDate)) {
        const id = getDeterministicNotificationId(txn.id, type, cycleDate);
        remindersToSchedule.push({
          id,
          title,
          body,
          schedule: { at: scheduledDate },
          extra: { debtId: txn.id, customerId: customer.id, type, cycleDate }
        });

        // Also prepare in-app notification
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
      addReminder(
        addDays(dueDate, -7),
        "due_7_days",
        "Payment coming up",
        `${customer.name} owes ${amountStr}. Payment is due in 7 days.`
      );
    }

    if (settings.remind3DaysBefore) {
      addReminder(
        addDays(dueDate, -3),
        "due_3_days",
        "Payment due soon",
        `${customer.name} owes ${amountStr}. Payment is due in 3 days.`
      );
    }

    if (settings.remind1DayBefore) {
      addReminder(
        addDays(dueDate, -1),
        "due_1_day",
        "Payment due tomorrow",
        `${customer.name} owes ${amountStr}. Payment is due tomorrow.`
      );
    }

    if (settings.remindOnDueDate) {
      addReminder(
        dueDate,
        "due_today",
        "Payment due today",
        `${customer.name} owes ${amountStr}. Payment is due today.`
      );
    }

    if (settings.remindOverdue) {
      for (let i = 1; i <= 3; i++) {
        const overdueDate = addDays(dueDate, 1 + (i - 1) * settings.overdueIntervalDays);
        const dateStr = format(overdueDate, "yyyy-MM-dd");
        addReminder(
          overdueDate,
          "overdue",
          "Payment overdue",
          `${customer.name}'s ${amountStr} payment is overdue.`,
          dateStr
        );
      }
    }

    if (remindersToSchedule.length > 0) {
      await LocalNotifications.schedule({
        notifications: remindersToSchedule.map(n => ({
          ...n,
          channelId: CHANNEL_ID,
          smallIcon: "ic_splash_logo",
          actionTypeId: "OPEN_DEBT",
        }))
      });
      console.log(`[TrackDebt Notifications] Scheduled ${remindersToSchedule.length} reminders for debt ${txn.id}`);
    }
  }

  // Update in-app notifications: merge new with old, avoiding duplicates based on debtId and type/cycleDate
  if (newInAppNotifs.length > 0) {
    setInAppNotifs(prev => {
      const filtered = prev.filter(p => !newInAppNotifs.some(n => n.id === p.id));
      return [...newInAppNotifs, ...filtered].slice(0, 100);
    });
  }
}


export async function cancelDebtReminders(debtId: string) {
  const pending = await LocalNotifications.getPending();
  const toCancel = pending.notifications
    .filter(n => n.extra?.debtId === debtId)
    .map(n => ({ id: n.id }));

  if (toCancel.length > 0) {
    await LocalNotifications.cancel({ notifications: toCancel });
    console.log(`[TrackDebt Notifications] Cancelled ${toCancel.length} reminders for debt ${debtId}`);
  }
}

export async function reconcileDebtReminders(
  customers: Customer[],
  settings: NotificationSettings,
  profile: BusinessProfile,
  inAppNotifs: InAppNotification[],
  setInAppNotifs: (n: InAppNotification[] | ((prev: InAppNotification[]) => InAppNotification[])) => void
) {
  console.log("[TrackDebt Notifications] Reconciling reminders...");
  const pending = await LocalNotifications.getPending();

  const activeDebtIds = new Set(
    customers.flatMap(c => openSales(c).map(s => s.txn.id))
  );

  const staleNotifications = pending.notifications
    .filter(n => !n.extra?.debtId || !activeDebtIds.has(n.extra.debtId))
    .map(n => ({ id: n.id }));

  if (staleNotifications.length > 0) {
    await LocalNotifications.cancel({ notifications: staleNotifications });
    console.log(`[TrackDebt Notifications] Cancelled ${staleNotifications.length} stale notifications.`);
  }

  // Also clean up in-app notifications for deleted/paid debts
  setInAppNotifs(prev => prev.filter(n => activeDebtIds.has(n.debtId)));

  if (settings.enabled) {
    for (const customer of customers) {
      if (balanceOf(customer) > 0) {
        await scheduleDebtReminders(customer, settings, profile, inAppNotifs, setInAppNotifs);
      }
    }
    await scheduleDailyReminder(customers, settings);
    await scheduleWeeklySummary(customers, settings);
  } else {

    // If disabled globally, clear all — Track Debt is the only thing
    // scheduling local notifications, so everything pending is ours.
    // (channelId is not available on PendingLocalNotificationSchema in 7.x)
    const allReminders = pending.notifications.map(n => ({ id: n.id }));
    if (allReminders.length > 0) {
      await LocalNotifications.cancel({ notifications: allReminders });
    }
  }

  console.log("[TrackDebt Notifications] Reconciliation complete.");
}


export async function addInAppNotification(
  notifications: InAppNotification[],
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

export function setupNotificationListeners(
  onAction: (action: ActionPerformed) => void
) {
  LocalNotifications.addListener("localNotificationActionPerformed", onAction);
}

export async function scheduleWeeklySummary(

  customers: Customer[],
  settings: NotificationSettings
) {
  if (!settings.enabled || !settings.weeklySummaryEnabled) {
    const pending = await LocalNotifications.getPending();
    const toCancel = pending.notifications
      .filter(n => n.extra?.type === "weekly_summary")
      .map(n => ({ id: n.id }));
    if (toCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: toCancel });
    }
    return;
  }

  // Calculate stats for the summary
  let totalOutstanding = 0;
  let count = 0;
  for (const c of customers) {
    const bal = balanceOf(c);
    if (bal > 0) {
      totalOutstanding += bal;
      count++;
    }
  }

  if (count === 0) return;

  const id = getDeterministicNotificationId("weekly", "weekly_summary");

  // Schedule for next Sunday at 10 AM
  const now = new Date();
  let nextSunday = addDays(startOfDay(now), (7 - now.getDay()) % 7);
  if (isBefore(setHours(nextSunday, 10), now)) {
    nextSunday = addDays(nextSunday, 7);
  }
  const scheduledTime = setMinutes(setHours(nextSunday, 10), 0);

  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title: "Your weekly debt report is ready",
        body: `${naira(totalOutstanding)} outstanding across ${count} ${count === 1 ? "customer" : "customers"}.`,
        schedule: { at: scheduledTime, repeats: true, every: "week" },
        channelId: CHANNEL_ID,
        smallIcon: "ic_splash_logo",
        extra: { type: "weekly_summary" }
      }
    ]
  });
}


