import { createFileRoute } from "@tanstack/react-router";
import { customerCode, isValidPlusCharge, metadataUserId, nextPaymentDate, subscriptionCode, verifyPaystackSignature, type PaystackEvent } from "@/lib/paystack.server";
import { webhookEventKey } from "@/lib/subscription.server";
import { createSupabaseAdmin } from "@/lib/supabase.server";

const lifecycleEvents = new Set(["subscription.create", "subscription.enable", "subscription.disable", "subscription.not_renew", "charge.failed"]);

export const Route = createFileRoute("/api/paystack/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        if (!verifyPaystackSignature(rawBody, request.headers.get("x-paystack-signature"))) {
          return Response.json({ ok: false, error: "Invalid signature." }, { status: 401 });
        }

        let payload: PaystackEvent;
        try {
          payload = JSON.parse(rawBody) as PaystackEvent;
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
        }
        const event = payload.event;
        const data = payload.data;
        if (!event || !data) return Response.json({ ok: false, error: "Invalid event." }, { status: 400 });

        const admin = createSupabaseAdmin();
        if (!admin) return Response.json({ ok: false, error: "Webhook is not configured." }, { status: 503 });
        const eventId = webhookEventKey(event, data);
        if (!eventId) return Response.json({ ok: false, error: "Event has no identifier." }, { status: 400 });

        const { error: eventError } = await admin.from("subscription_events").insert({
          event_id: eventId,
          event_name: event,
          reference: data.reference ?? null,
        });
        if (eventError) {
          if (eventError.code === "23505") return Response.json({ ok: true, duplicate: true });
          console.error(eventError);
          return Response.json({ ok: false, error: "Could not record webhook." }, { status: 503 });
        }

        if (event === "charge.success") {
          if (!isValidPlusCharge(data)) return Response.json({ ok: true, ignored: "amount_or_currency" });
          const userId = metadataUserId(data);
          const resolvedUserId =
            userId ??
            (customerCode(data)
              ? (await admin
                  .from("subscriptions")
                  .select("user_id")
              .eq("paystack_customer_code", customerCode(data))
                  .maybeSingle()).data?.user_id
              : null);
          if (!resolvedUserId) return Response.json({ ok: true, ignored: "unknown_user" });

          const paidAt = data.paid_at ?? data.transaction_date ?? new Date().toISOString();
          const periodEnd = nextPaymentDate(data);
          await admin.from("subscriptions").upsert(
            {
              user_id: resolvedUserId,
              plan: "plus",
              status: "active",
              paystack_customer_code: customerCode(data),
              paystack_subscription_code: subscriptionCode(data),
              paystack_email_token: data.email_token ?? null,
              paystack_authorization: data.authorization ?? null,
              last_transaction_reference: data.reference ?? null,
              amount: data.amount,
              currency: data.currency,
              subscription_start_at: paidAt,
              current_period_start: paidAt,
              current_period_end: periodEnd,
              cancellation_at: null,
              last_successful_payment_at: paidAt,
              next_expected_payment_at: periodEnd,
            },
            { onConflict: "user_id" },
          );
          return Response.json({ ok: true });
        }

        if (lifecycleEvents.has(event)) {
          const paystackCustomerCode = customerCode(data);
          const paystackSubscriptionCode = subscriptionCode(data);
          const isFailure = event === "charge.failed";
          const query = admin.from("subscriptions").update({
            ...(event === "subscription.create" || event === "subscription.enable" ? {} : { status: isFailure ? "failed" : "cancelled" }),
            ...(isFailure || event === "subscription.create" || event === "subscription.enable" ? {} : { cancellation_at: new Date().toISOString() }),
            ...(data.email_token ? { paystack_email_token: data.email_token } : {}),
            ...(paystackSubscriptionCode ? { paystack_subscription_code: paystackSubscriptionCode } : {}),
            ...(paystackCustomerCode ? { paystack_customer_code: paystackCustomerCode } : {}),
            ...(!isFailure && nextPaymentDate(data) ? { next_expected_payment_at: nextPaymentDate(data), current_period_end: nextPaymentDate(data) } : {}),
          });
          const result = paystackCustomerCode
            ? await query.eq("paystack_customer_code", paystackCustomerCode)
            : paystackSubscriptionCode
              ? await query.eq("paystack_subscription_code", paystackSubscriptionCode)
              : { error: null };
          if (result.error) {
            console.error(result.error);
            return Response.json({ ok: false, error: "Could not update subscription." }, { status: 503 });
          }
        }

        return Response.json({ ok: true });
      },
    },
  },
});