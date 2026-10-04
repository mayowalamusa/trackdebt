import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { paystackApi, requirePlusUser } from "@/lib/paystack-collect.server";

const schema = z.object({
  customerId: z.string().trim().min(1).max(64),
  customerName: z.string().trim().max(100).default(""),
  amount: z.number().positive().max(100_000_000),
});

export const Route = createFileRoute("/api/paystack/collect/link")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requirePlusUser(request);
        if (auth instanceof Response) return auth;
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ ok: false, error: "Invalid amount." }, { status: 400 });
        const { data: sub } = await auth.admin
          .from("paystack_subaccounts").select("subaccount_code").eq("user_id", auth.user.id).maybeSingle();
        if (!sub) return Response.json({ ok: false, error: "Add your bank account in Settings first." }, { status: 409 });
        const ref = `TDC-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
        try {
          const data = await paystackApi<{ authorization_url: string }>("/transaction/initialize", {
            method: "POST",
            body: {
              email: `pay-${ref.toLowerCase()}@trackdebt.app`,
              amount: Math.round(parsed.data.amount * 100),
              currency: "NGN",
              reference: ref,
              subaccount: sub.subaccount_code,
              bearer: "subaccount",
              channels: ["card", "bank", "ussd", "bank_transfer"],
              metadata: {
                kind: "debt_payment",
                user_id: auth.user.id,
                customer_id: parsed.data.customerId,
                customer_name: parsed.data.customerName,
              },
            },
          });
          return Response.json({ ok: true, url: data.authorization_url, reference: ref });
        } catch (error) {
          console.error(error);
          return Response.json({ ok: false, error: "Could not create the payment link." }, { status: 502 });
        }
      },
    },
  },
});
