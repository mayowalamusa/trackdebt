import { createFileRoute } from "@tanstack/react-router";
import { disablePaystackSubscription } from "@/lib/paystack.server";
import { createSupabaseAdmin, userFromRequest } from "@/lib/supabase.server";
import { getSubscription } from "@/lib/subscription.server";

export const Route = createFileRoute("/api/paystack/cancel")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await userFromRequest(request);
        const admin = createSupabaseAdmin();
        if (!user) return Response.json({ ok: false, error: "Sign in required." }, { status: 401 });
        if (!admin) return Response.json({ ok: false, error: "Billing is not configured." }, { status: 503 });
        const subscription = await getSubscription(admin, user.id);
        if (!subscription?.paystack_subscription_code || !subscription.paystack_email_token) {
          return Response.json({ ok: false, error: "No active Paystack subscription found." }, { status: 409 });
        }
        try {
          await disablePaystackSubscription(subscription.paystack_subscription_code, subscription.paystack_email_token);
          return Response.json({ ok: true });
        } catch (error) {
          console.error(error);
          return Response.json({ ok: false, error: "Could not cancel the subscription." }, { status: 502 });
        }
      },
    },
  },
});