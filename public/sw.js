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
