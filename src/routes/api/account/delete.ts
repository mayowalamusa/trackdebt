import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseAdmin, userFromRequest } from "@/lib/supabase.server";
import { disablePaystackSubscription } from "@/lib/paystack.server";
import { getSubscription } from "@/lib/subscription.server";

export const Route = createFileRoute("/api/account/delete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await userFromRequest(request);
        const admin = createSupabaseAdmin();
        if (!user) return Response.json({ ok: false, error: "Sign in required." }, { status: 401 });
        if (!admin) return Response.json({ ok: false, error: "Account service is not configured." }, { status: 503 });
        const subscription = await getSubscription(admin, user.id);
        if (subscription?.paystack_subscription_code && subscription.paystack_email_token) {
          try {
            await disablePaystackSubscription(subscription.paystack_subscription_code, subscription.paystack_email_token);
          } catch {
            return Response.json({ ok: false, error: "Cancel the active Plus renewal before deleting this account." }, { status: 409 });
          }
        }
        const { data: restorableUntil, error } = await admin.rpc("trackdebt_request_account_deletion", { target_user: user.id });
        if (error) return Response.json({ ok: false, error: "Could not start account deletion." }, { status: 503 });
        return Response.json({ ok: true, restorableUntil });
      },
    },
  },
});