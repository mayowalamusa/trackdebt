// Capacitor-only stand-in for src/lib/reminders.functions.ts.
//
// The real file's `generateReminder` is built on TanStack Start's
// `createServerFn`. In this TanStack Start version, `createServerFn`'s
// implementation unconditionally imports `getStartContextServerOnly`,
// which pulls in `@tanstack/start-storage-context` — and that imports
// Node's `node:async_hooks` for `AsyncLocalStorage`, even for the
// "client-callable" side of a server function. That's fine for the real
// SSR web build (a real Node/Workers runtime provides `async_hooks`), but
// Capacitor's Android WebView has no Node runtime, so the app crashed on
// boot the moment this module was evaluated.
//
// This file is swapped in for `@/lib/reminders.functions` ONLY when
// building for Capacitor (see the `resolve.alias` in
// vite.client.config.ts) — the real file, and the route that calls it
// (src/routes/index.tsx), are both completely unchanged. Same function
// name, same input/output shape, just called over a plain fetch instead
// of TanStack Start's RPC machinery, so nothing importing
// `@tanstack/react-start` ends up in the Capacitor bundle.
//
// Note: there's no bundled server inside the Android app to answer this
// request yet, so until a real API base URL is configured for native
// builds, this will fail gracefully (the caller already handles a
// non-ok result) rather than crash the app.
import { z } from "zod";

const InputSchema = z.object({
  customerName: z.string().min(1),
  businessName: z.string().min(1),
  outstanding: z.string().min(1),
  originalAmount: z.string().min(1),
  dueDate: z.string().nullable(),
  daysOverdue: z.number(),
  status: z.string(),
  tone: z.enum(["friendly", "professional", "firm"]),
});

type ReminderInput = z.infer<typeof InputSchema>;
type ReminderResult = { ok: true; message: string } | { ok: false; error: string };

export async function generateReminder({ data }: { data: ReminderInput }): Promise<ReminderResult> {
  InputSchema.parse(data);
  try {
    const res = await fetch("/api/generate-reminder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      return { ok: false, error: "Could not generate a message. Please try again." };
    }
    return (await res.json()) as ReminderResult;
  } catch {
    return { ok: false, error: "Could not generate a message. Please try again." };
  }
}
