// Track Debt Service Worker
// Handles background notification delivery.
//
// The main app schedules reminders by writing them to localStorage.
// This service worker wakes up periodically, reads those scheduled
// reminders, and fires any that are now due — even when the app tab
// is closed or the phone screen is off.
//
// Storage key: "trackdebt.v3.notificationRecords"
// Each record: { id, title, body, scheduledFor (ISO), status, read }

const STORAGE_KEY = "trackdebt.v3.notificationRecords";
const CHECK_TAG = "trackdebt-notification-check";
const ICON = "/icons/icon-192.png";
const BADGE = "/icons/icon-192.png";

// ── Install & activate ──────────────────────────────────────────────
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Periodic background sync (Chrome/Android) ───────────────────────
// Fires roughly every 12 hours when the browser allows it.
self.addEventListener("periodicsync", (event) => {
  if (event.tag === CHECK_TAG) {
    event.waitUntil(fireScheduledNotifications());
  }
});

// ── Message from the main app ───────────────────────────────────────
// The app sends a "CHECK_NOTIFICATIONS" message on load and on
// visibility change so reminders fire promptly while the tab is open.
self.addEventListener("message", (event) => {
  if (event.data?.type === "CHECK_NOTIFICATIONS") {
    event.waitUntil(fireScheduledNotifications());
  }
  if (event.data?.type === "SCHEDULE_PERIODIC_SYNC") {
    // Register periodic background sync when the app asks for it.
    event.waitUntil(registerPeriodicSync());
  }
});

// ── Notification click ──────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const customerId = event.notification.data?.customerId;
  const notifId = event.notification.data?.notifId;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Store the pending deep-link so the app can pick it up on open.
      if (customerId || notifId) {
        // We can't write to localStorage from a SW — we'll send a message
        // instead, or let the app read from notification data on focus.
        const target = clients.find((c) => c.url.includes(self.location.origin));
        if (target) {
          target.focus();
          target.postMessage({ type: "NOTIFICATION_TAP", customerId, notifId });
          return;
        }
      }
      // Open a new tab if none is open.
      return self.clients.openWindow("/");
    })
  );
});

// ── Core: fire scheduled reminders ─────────────────────────────────
async function fireScheduledNotifications() {
  const permission = self.Notification?.permission;
  if (permission !== "granted") return;

  let records = [];
  try {
    // Read from the shared localStorage via the IDB-backed client cache.
    // SWs can't access localStorage directly, so we ask an open client.
    const clients = await self.clients.matchAll({ type: "window" });
    if (clients.length > 0) {
      // Ask a live tab to read and return the records.
      const result = await new Promise((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (e) => resolve(e.data);
        clients[0].postMessage({ type: "GET_NOTIFICATION_RECORDS" }, [channel.port2]);
        // Timeout after 2 seconds.
        setTimeout(() => resolve(null), 2000);
      });
      if (result?.records) records = result.records;
    } else {
      // No live tab — we can't read localStorage. Skip this cycle.
      return;
    }
  } catch {
    return;
  }

  const now = new Date();
  const toFire = records.filter(
    (r) =>
      r.status === "scheduled" &&
      !r.read &&
      new Date(r.scheduledFor) <= now
  );

  for (const record of toFire) {
    try {
      await self.registration.showNotification(record.title, {
        body: record.body,
        icon: ICON,
        badge: BADGE,
        tag: record.id,
        renotify: false,
        data: {
          customerId: record.customerId,
          notifId: record.id,
        },
      });
    } catch {
      // Notification failed — continue with others.
    }
  }

  // Ask the live tab to mark these as delivered.
  if (toFire.length > 0) {
    const clients = await self.clients.matchAll({ type: "window" });
    if (clients.length > 0) {
      clients[0].postMessage({
        type: "MARK_NOTIFICATIONS_DELIVERED",
        ids: toFire.map((r) => r.id),
      });
    }
  }
}

// ── Register periodic background sync ──────────────────────────────
async function registerPeriodicSync() {
  if (!self.registration.periodicSync) return;
  try {
    const tags = await self.registration.periodicSync.getTags();
    if (!tags.includes(CHECK_TAG)) {
      await self.registration.periodicSync.register(CHECK_TAG, {
        minInterval: 60 * 60 * 1000, // 1 hour minimum (browser may throttle)
      });
    }
  } catch {
    // periodicSync not available or permission denied — silent fallback.
  }
}

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
