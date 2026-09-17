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
  reminderTime: string;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
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
  createdAt: string;
  scheduledFor: string;
  read: boolean;
  status: "scheduled" | "delivered" | "cancelled";
};

type PermissionState = "granted" | "denied" | "prompt";

const NOTIFIED_STORAGE_KEY = "trackdebt.v3.web_notified_ids";
const SERVICE_WORKER_PATH = "/notification-sw.js";

function browserPermission(): PermissionState | null {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  const permission = Notification.permission;
  return permission === "default" ? "prompt" : permission;
}

export async function initNotifications() {
  // Web notifications require HTTPS (except localhost) and a user-granted
  // permission. Do not request permission automatically on page load because
  // browsers increasingly require a user gesture for permission prompts.
  if (typeof window === "undefined") return;

  if ("serviceWorker" in navigator && window.isSecureContext) {
    try {
      await navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: "/" });
    } catch (error) {
      console.warn("[TrackDebt Notifications] Service worker registration failed", error);
    }
  }
}

export async function checkPermissions(): Promise<PermissionState> {
  return browserPermission() ?? "granted";
}

export async function requestPermissions(): Promise<PermissionState> {
  const current = browserPermission();
  if (current === null) return "granted";
  if (current === "granted" || current === "denied") return current;

  try {
    const result = await Notification.requestPermission();
    return result === "default" ? "prompt" : result;
  } catch {
    return "denied";
  }
}

function getDeterministicNotificationId(idBase: string, type: PaymentReminderType, cycleDate?: string): number {
  const str = `${idBase}_${type}${cycleDate ? "_" + cycleDate : ""}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getNotifiedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveNotifiedIds(ids: Set<string>) {
  try {
    // Keep this bounded so the local storage entry cannot grow forever.
    localStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify(Array.from(ids).slice(-500)));
  } catch {
    // Notification delivery should never break the app if storage is unavailable.
  }
}

async function showWebNotification(
  title: string,
  body: string,
  data: { debtId?: string; customerId?: string; notifId?: string }
) {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  const options: NotificationOptions = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.notifId ?? `trackdebt-${Date.now()}`,
    data,
  };

  try {
    // Service-worker notifications work on mobile browsers where
    // new Notification() commonly throws. Use an active registration first.
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.active) {
        await registration.showNotification(title, options);
        return true;
      }
    }

    // Desktop fallback when no service worker is active.
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
    };
    return true;
  } catch (error) {
    console.warn("[TrackDebt Notifications] Could not show notification", error);
    return false;
  }
}

async function deliverDueWebNotifications(records: InAppNotification[]) {
  if (typeof window === "undefined") return;
  if (browserPermission() !== "granted") return;

  const now = Date.now();
  const notified = getNotifiedIds();
  let changed = false;

  for (const record of records) {
    if (record.status !== "scheduled" || record.read) continue;
    if (new Date(record.scheduledFor).getTime() > now) continue;
    if (notified.has(record.id)) continue;

    const shown = await showWebNotification(record.title, record.body, {
      debtId: record.debtId,
      customerId: record.customerId,
      notifId: record.id,
    });

    if (shown) {
      notified.add(record.id);
      changed = true;
    }
  }

  if (changed) saveNotifiedIds(notified);
}

export async function scheduleDailyReminder(
  customers: Customer[],
  settings: NotificationSettings
) {
  if (!settings.enabled || !settings.dailyReminderEnabled) return;
  if (browserPermission() !== "granted") return;

  const [hours, minutes] = settings.dailyReminderTime.split(":").map(Number);
  const now = new Date();
  const scheduledDate = setMinutes(setHours(startOfDay(now), hours || 19), minutes || 0);

  if (now < scheduledDate) return;
  if (customers.length === 0) return;

  const id = `daily_${now.toISOString().slice(0, 10)}`;
  const notified = getNotifiedIds();
  if (notified.has(id)) return;

  const shown = await showWebNotification(
    "Track Debt",
    "Don't forget to record today's debts and payments.",
    { notifId: id }
  );
  if (shown) {
    notified.add(id);
    saveNotifiedIds(notified);
  }
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
      const id = String(getDeterministicNotificationId(txn.id, type, cycleDate));

      // Keep reminders scheduled for the future in the in-app centre.
      if (isBefore(now, scheduledDate)) {
        newInAppNotifs.push({
          id,
          debtId: txn.id,
          customerId: customer.id,
          type,
          title,
          body,
          createdAt: now.toISOString(),
          scheduledFor: scheduledDate.toISOString(),
          read: false,
          status: "scheduled",
        });
      }

      // If the reminder time has already arrived, deliver it immediately
      // when the app is open/resumed. This is what makes web notifications
      // actually fire instead of only appearing in the in-app centre.
      if (!isBefore(now, scheduledDate)) {
        const notified = getNotifiedIds();
        if (!notified.has(id)) {
          void showWebNotification(title, body, {
            debtId: txn.id,
            customerId: customer.id,
            notifId: id,
          }).then((shown) => {
            if (shown) {
              notified.add(id);
              saveNotifiedIds(notified);
            }
          });
        }
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

  if (newInAppNotifs.length > 0) {
    setInAppNotifs(prev => {
      const filtered = prev.filter(p => !newInAppNotifs.some(n => n.id === p.id));
      return [...newInAppNotifs, ...filtered].slice(0, 100);
    });
  }

  await deliverDueWebNotifications(newInAppNotifs);
}

export async function cancelDebtReminders(_debtId: string) {
  // Scheduled reminders are reconciled from current debt state.
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

  setInAppNotifs(prev => prev.filter(n => activeDebtIds.has(n.debtId)));

  if (settings.enabled) {
    for (const customer of customers) {
      if (balanceOf(customer) > 0) {
        await scheduleDebtReminders(customer, settings, profile, inAppNotifs, setInAppNotifs);
      }
    }
    await scheduleDailyReminder(customers, settings);
  }

  // Deliver any reminders that became due while the tab was asleep or hidden.
  await deliverDueWebNotifications(inAppNotifs);
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

export type NotificationAction = {
  notification: { extra?: { debtId?: string; customerId?: string; type?: PaymentReminderType } };
};

export function setupNotificationListeners(
  onAction: (action: NotificationAction) => void
) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return () => {};

  const handler = (event: MessageEvent) => {
    if (event.data?.type !== "NOTIFICATION_TAP") return;
    onAction({
      notification: {
        extra: {
          debtId: event.data.debtId,
          customerId: event.data.customerId,
          type: event.data.type,
        },
      },
    });
  };

  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}

export async function scheduleWeeklySummary(
  _customers: Customer[],
  _settings: NotificationSettings
) {
  // Weekly summaries can use the same web notification mechanism when the
  // app is active; true closed-app delivery requires Web Push + a server.
}
