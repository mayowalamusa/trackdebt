const CACHE_VERSION = "trackdebt-notifications-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const url = new URL("/", self.location.origin);
  if (data.customerId) url.searchParams.set("customer", data.customerId);
  if (data.debtId) url.searchParams.set("debt", data.debtId);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existing) {
        existing.focus();
        existing.postMessage({
          type: "NOTIFICATION_TAP",
          debtId: data.debtId,
          customerId: data.customerId,
          reminderType: data.reminderType,
        });
        return;
      }
      return self.clients.openWindow(url.href);
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
