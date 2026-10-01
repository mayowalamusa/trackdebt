import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type Announcement = {
  id: string;
  message: string;
  link: string | null;
  priority: number;
};

const DISMISS_KEY = "trackdebt.dismissed-announcements";

function readDismissed(): string[] {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function AnnouncementBanner() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, message, link, priority")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);

      if (cancelled || error || !data?.length) return;
      const dismissed = readDismissed();
      const next = data.find((a) => !dismissed.includes(a.id));
      if (next) setAnnouncement(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (!announcement || pathname.startsWith("/admin")) return null;

  function dismiss() {
    if (!announcement) return;
    try {
      window.localStorage.setItem(DISMISS_KEY, JSON.stringify([...readDismissed(), announcement.id]));
    } catch {
      /* storage unavailable — dismiss for this session only */
    }
    setAnnouncement(null);
  }

  return (
    <div className="sticky top-0 z-50 flex items-start gap-3 border-b border-primary/30 bg-primary/10 px-4 py-2.5 text-sm text-foreground">
      <p className="flex-1 leading-snug">
        {announcement.message}
        {announcement.link && (
          <a
            href={announcement.link}
            target="_blank"
            rel="noreferrer"
            className="ml-2 font-semibold text-primary underline"
          >
            Learn more
          </a>
        )}
      </p>
      <button
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="shrink-0 rounded-md px-2 py-0.5 text-muted-foreground hover:text-foreground"
      >
        ✕
      </button>
    </div>
  );
}
