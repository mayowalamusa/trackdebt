const KEY = "trackdebt.analytics.visitor";

function getVisitorId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return "ephemeral-" + Math.random().toString(36).slice(2);
  }
}

export function trackSiteVisit(): void {
  if (typeof window === "undefined") return;
  void fetch("/api/track-visit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId: getVisitorId() }),
    keepalive: true,
  }).catch(() => undefined);
}