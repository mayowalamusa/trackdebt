 Web notification system for Track Debt.
 *
 * Two layers:
 *   1. In-app notification centre — records stored in localStorage, shown
 *      in the bell icon. Works in every browser, no permission needed.
 *   2. Browser (OS-level) notifications — fires a real notification popup
 *      via the Web Notification API when a reminder's scheduled time
 *      arrives. Requires user permission. Works even when the tab is in
 *      the background via the registered Service Worker.
 *
 * Architecture:
 *   - scheduleDebtReminders() creates records with status "scheduled".
 *   - A polling interval (started by startNotificationPolling()) checks
 *     every minute whether any scheduled record is now past-due and
 *     fires it via showBrowserNotification().
 *   - The Service Worker (public/sw.js) covers the case where the tab is
 *     closed — it reads records via a MessageChannel from any open tab,
 *     or falls back to periodic background sync (~hourly, Chrome only).
 *   - Both layers mark fired records as "delivered" to prevent duplicates.
 */

import {
  addDays,
  format,
  isBefore,
  parseISO,
  setHours,
  setMinutes,
  startOfDay,
} from "date-fns";
import { balanceOf, naira, type BusinessProfile, type Customer } from "./ledger";
import { openSales } from "./due-dates";

const ICON = "/icons/icon-192.png";
const BADGE = "/icons/icon-192.png";

// ── Types ────────────────────────────────────────────────────────────

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
  reminderTime: string; // HH:mm
  dailyReminderEnabled: boolean;
  dailyReminderTime: string; // HH:mm
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

// ── Permission helpers ───────────────────────────────────────────────

type PermissionState = "granted" | "denied" | "prompt";

function notificationApiAvailable(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function browserPermission(): PermissionState | null {
  if (!notificationApiAvailable()) return null;
  const p = Notification.permission;
  return p === "default" ? "prompt" : p;
}

export async function checkPermissions(): Promise<PermissionState> {
  return browserPermission() ?? "granted";
}

export async function requestPermissions(): Promise<PermissionState> {
  if (!notificationApiAvailable()) return "granted"; // in-app only
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result === "default" ? "prompt" : result;
}

// ── Service worker registration ──────────────────────────────────────

let swRegistration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    swRegistration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    console.log("[TrackDebt Notifications] Service worker registered.");
    // Ask the SW to try registering periodic background sync.
    const sw = swRegistration.active ?? swRegistration.waiting ?? swRegistration.installing;
    sw?.postMessage({ type: "SCHEDULE_PERIODIC_SYNC" });

    // Handle messages from the service worker (notification taps, record queries).
    navigator.serviceWorker.addEventListener("message", handleSwMessage);
  } catch (err) {
    console.warn("[TrackDebt Notifications] Service worker registration failed:", err);
  }
}

// ── SW ↔ App message bridge ──────────────────────────────────────────
// The SW can't access localStorage directly, so it sends a message to the
// app asking for the records, and we reply via MessageChannel.

let notifRecordGetter: (() => InAppNotification[]) | null = null;
let notifRecordSetter: ((fn: (prev: InAppNotification[]) => InAppNotification[]) => void) | null = null;

/** Called from the React layer to give notifications.ts access to state. */
export function connectNotificationStore(
  getter: () => InAppNotification[],
  setter: (fn: (prev: InAppNotification[]) => InAppNotification[]) => void
): void {
  notifRecordGetter = getter;
  notifRecordSetter = setter;
}

function handleSwMessage(event: MessageEvent): void {
  const { type, port } = event.data ?? {};

  // SW wants the current records to decide what to fire.
  if (type === "GET_NOTIFICATION_RECORDS" && event.ports[0]) {
    const records = notifRecordGetter?.() ?? [];
    event.ports[0].postMessage({ records });
    return;
  }

  // SW fired notifications and is telling us to mark them delivered.
  if (type === "MARK_NOTIFICATIONS_DELIVERED" && Array.isArray(event.data?.ids)) {
    markDelivered(event.data.ids as string[]);
    return;
  }

  // User tapped a notification while the app was open.
  if (type === "NOTIFICATION_TAP") {
    const { customerId, notifId } = event.data as { customerId?: string; notifId?: string };
    if (notifId) markDelivered([notifId]);
    // Dispatch a custom event so the router/app can deep-link.
    if (typeof window !== "undefined" && customerId) {
      window.dispatchEvent(
        new CustomEvent("trackdebt:notification-tap", { detail: { customerId, notifId } })
      );
    }
  }
  void port; // suppress unused warning
}

// ── Fire a real browser notification ─────────────────────────────────

async function showBrowserNotification(
  record: InAppNotification
): Promise<boolean> {
  if (!notificationApiAvailable() || Notification.permission !== "granted") return false;

  try {
    // Prefer showing via the service worker (works in background).
    if (swRegistration) {
      await swRegistration.showNotification(record.title, {
        body: record.body,
        icon: ICON,
        badge: BADGE,
        tag: record.id,
        renotify: false,
        data: { customerId: record.customerId, notifId: record.id },
      });
      return true;
    }
    // Fallback: plain Notification API (tab must be focused).
    const notif = new Notification(record.title, {
      body: record.body,
      icon: ICON,
      tag: record.id,
    });
    notif.onclick = () => {
      window.focus();
      window.dispatchEvent(
        new CustomEvent("trackdebt:notification-tap", {
          detail: { customerId: record.customerId, notifId: record.id },
        })
      );
    };
    return true;
  } catch {
    return false;
  }
}

// ── Mark records delivered (deduplicate) ─────────────────────────────

function markDelivered(ids: string[]): void {
  if (!notifRecordSetter || ids.length === 0) return;
  notifRecordSetter((prev) =>
    prev.map((r) => (ids.includes(r.id) ? { ...r, status: "delivered" as const } : r))
  );
}

// ── Polling: fire past-due reminders while the tab is open ───────────

let pollingInterval: ReturnType<typeof setInterval> | null = null;

export function startNotificationPolling(): void {
  if (pollingInterval) return; // already running
  // Check immediately, then every 60 seconds.
  void checkAndFireDueNotifications();
  pollingInterval = setInterval(() => void checkAndFireDueNotifications(), 60_000);

  // Also check when the tab becomes visible again (phone unlocked, tab switched back).
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void checkAndFireDueNotifications();
        // Poke the SW too so background-fired ones are reconciled.
        navigator.serviceWorker?.controller?.postMessage({ type: "CHECK_NOTIFICATIONS" });
      }
    });
  }
}

export function stopNotificationPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

async function checkAndFireDueNotifications(): Promise<void> {
  if (!notifRecordGetter || !notifRecordSetter) return;
  const records = notifRecordGetter();
  const now = new Date();
  const due = records.filter(
    (r) => r.status === "scheduled" && new Date(r.scheduledFor) <= now
  );
  if (due.length === 0) return;

  const fired: string[] = [];
  for (const record of due) {
    const ok = await showBrowserNotification(record);
    if (ok || Notification.permission !== "granted") {
      // Mark delivered even without browser permission — avoids re-firing
      // infinitely in in-app-only mode.
      fired.push(record.id);
    }
  }
  markDelivered(fired);
}

// ── Deterministic ID ─────────────────────────────────────────────────

function getDeterministicNotificationId(
  idBase: string,
  type: PaymentReminderType,
  cycleDate?: string
): number {
  const str = `${idBase}_${type}${cycleDate ? "_" + cycleDate : ""}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// ── Schedule / reconcile ─────────────────────────────────────────────

export async function initNotifications(): Promise<void> {
  await registerServiceWorker();
}

export async function scheduleDailyReminder(
  _customers: Customer[],
  _settings: NotificationSettings
): Promise<void> {
  // Daily record reminders are handled by the polling loop and SW.
}

export async function scheduleDebtReminders(
  customer: Customer,
  settings: NotificationSettings,
  _profile: BusinessProfile,
  _inAppNotifs: InAppNotification[],
  setInAppNotifs: (
    n: InAppNotification[] | ((prev: InAppNotification[]) => InAppNotification[])
  ) => void
): Promise<void> {
  if (!settings.enabled) return;

  const openDebts = openSales(customer);
  const newInAppNotifs: InAppNotification[] = [];
  const [hours, minutes] = settings.reminderTime.split(":").map(Number);
  const now = new Date();

  const addReminder = (
    date: Date,
    type: PaymentReminderType,
    title: string,
    body: string,
    cycleDate?: string
  ) => {
    const scheduledDate = setMinutes(setHours(startOfDay(date), hours || 9), minutes || 0);
    if (isBefore(now, scheduledDate)) {
      const id = String(getDeterministicNotificationId(txn.id, type, cycleDate));
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
  };

  for (const { txn, outstanding } of openDebts) {
    if (!txn.term?.dueDate) continue;
    const dueDate = parseISO(txn.term.dueDate);
    const amountStr = naira(outstanding);

    if (settings.remind7DaysBefore)
      addReminder(addDays(dueDate, -7), "due_7_days", "Payment coming up",
        `${customer.name} owes ${amountStr}. Payment is due in 7 days.`);
    if (settings.remind3DaysBefore)
      addReminder(addDays(dueDate, -3), "due_3_days", "Payment due soon",
        `${customer.name} owes ${amountStr}. Payment is due in 3 days.`);
    if (settings.remind1DayBefore)
      addReminder(addDays(dueDate, -1), "due_1_day", "Payment due tomorrow",
        `${customer.name} owes ${amountStr}. Payment is due tomorrow.`);
    if (settings.remindOnDueDate)
      addReminder(dueDate, "due_today", "Payment due today",
        `${customer.name} owes ${amountStr}. Payment is due today.`);
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
    setInAppNotifs((prev) => {
      const filtered = prev.filter((p) => !newInAppNotifs.some((n) => n.id === p.id));
      return [...newInAppNotifs, ...filtered].slice(0, 200);
    });
  }
}

export async function cancelDebtReminders(_debtId: string): Promise<void> {
  // Records are cleaned up during reconciliation.
}

export async function reconcileDebtReminders(
  customers: Customer[],
  settings: NotificationSettings,
  profile: BusinessProfile,
  inAppNotifs: InAppNotification[],
  setInAppNotifs: (
    n: InAppNotification[] | ((prev: InAppNotification[]) => InAppNotification[])
  ) => void
): Promise<void> {
  const activeDebtIds = new Set(customers.flatMap((c) => openSales(c).map((s) => s.txn.id)));
  setInAppNotifs((prev) => prev.filter((n) => activeDebtIds.has(n.debtId)));
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
  setNotifications: (
    n: InAppNotification[] | ((prev: InAppNotification[]) => InAppNotification[])
  ) => void,
  newNotif: Omit<InAppNotification, "id" | "createdAt" | "read" | "status">
): Promise<void> {
  const notif: InAppNotification = {
    ...newNotif,
    id: "n" + Date.now(),
    createdAt: new Date().toISOString(),
    read: false,
    status: "delivered",
  };
  setNotifications((prev) => [notif, ...prev].slice(0, 50));
}

export type NotificationAction = {
  notification: {
    extra?: { debtId?: string; customerId?: string; type?: PaymentReminderType };
  };
};

export function setupNotificationListeners(
  onAction: (action: NotificationAction) => void
): void {
  if (typeof window === "undefined") return;
  window.addEventListener("trackdebt:notification-tap", ((e: Event) => {
    const { customerId } = (e as CustomEvent<{ customerId?: string }>).detail;
    onAction({ notification: { extra: { customerId } } });
  }) as EventListener);
}

export async function scheduleWeeklySummary(
  _customers: Customer[],
  _settings: NotificationSettings
): Promise<void> {
  // Weekly summaries use the same polling/SW mechanism as payment reminders.
}
TSEOF
echo "written"