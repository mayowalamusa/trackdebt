import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";

import { buildReminderPrompt, createLovableAiGatewayProvider } from "./ai-gateway.server";
import { getEntitlement } from "./subscription.server";
import { createSupabaseAdmin, userFromAccessToken } from "./supabase.server";

const InputSchema = z.object({
  customerName: z.string().min(1),
  businessName: z.string().min(1),
  outstanding: z.string().min(1),
  originalAmount: z.string().min(1),
  dueDate: z.string().nullable(),
  daysOverdue: z.number(),
  status: z.string(),
  tone: z.enum(["friendly", "professional", "firm"]),
  accessToken: z.string().min(1).optional(),
});

export const generateReminder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const admin = createSupabaseAdmin();
    const user = await userFromAccessToken(data.accessToken ?? null);
    const entitlement = admin && user ? await getEntitlement(admin, user.id) : null;
    if (!entitlement || entitlement.plan !== "plus") {
      return {
        ok: false as const,
        error: "AI reminders are available on Track Debt Plus and Premium.",
      };
    }

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) {
      return { ok: false as const, error: "AI is not configured yet." };
    }

    try {
      const gateway = createLovableAiGatewayProvider(key);
      const result = streamText({
        model: gateway("google/gemini-3.6-flash"),
        prompt: buildReminderPrompt(data),
      });
      const text = (await result.text).trim();
      if (!text) return { ok: false as const, error: "The AI returned an empty message." };
      return { ok: true as const, message: text };
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI generation failed.";
      if (message.includes("429"))
        return { ok: false as const, error: "AI is busy right now. Please try again shortly." };
      if (message.includes("402"))
        return { ok: false as const, error: "AI credits are exhausted for this workspace." };
      return { ok: false as const, error: "Could not generate a message. Please try again." };
    }
  });
