import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { paystackApi, platformFeePercent, requirePlusUser } from "@/lib/paystack-collect.server";

const schema = z.object({
  businessName: z.string().trim().min(2).max(100),
  bankCode: z.string().trim().regex(/^[0-9A-Za-z-]{2,20}$/),
  bankName: z.string().trim().max(100).default(""),
  accountNumber: z.string().trim().regex(/^\d{10}$/, "Account number must be 10 digits."),
});

export const Route = createFileRoute("/api/paystack/collect/setup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requirePlusUser(request);
        if (auth instanceof Response) return auth;
        const { data } = await auth.admin
          .from("paystack_subaccounts")
          .select("business_name,bank_name,account_number,account_name,percentage_charge")
          .eq("user_id", auth.user.id)
          .maybeSingle();
        return Response.json({ ok: true, account: data ?? null, feePercent: platformFeePercent() });
      },
      POST: async ({ request }) => {
        const auth = await requirePlusUser(request);
        if (auth instanceof Response) return auth;
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details." }, { status: 400 });
        }
        const input = parsed.data;
        const fee = platformFeePercent();
        try {
          const resolved = await paystackApi<{ account_name: string }>(
            `/bank/resolve?account_number=${input.accountNumber}&bank_code=${encodeURIComponent(input.bankCode)}`,
          );
          const { data: existing } = await auth.admin
            .from("paystack_subaccounts").select("subaccount_code").eq("user_id", auth.user.id).maybeSingle();
          const payload = {
            business_name: input.businessName,
            settlement_bank: input.bankCode,
            account_number: input.accountNumber,
            percentage_charge: fee,
          };
          const sub = existing
            ? await paystackApi<{ subaccount_code: string }>(`/subaccount/${existing.subaccount_code}`, { method: "PUT", body: payload })
            : await paystackApi<{ subaccount_code: string }>("/subaccount", { method: "POST", body: payload });
          const { error } = await auth.admin.from("paystack_subaccounts").upsert({
            user_id: auth.user.id,
            subaccount_code: sub.subaccount_code ?? existing?.subaccount_code,
            business_name: input.businessName,
            bank_code: input.bankCode,
            bank_name: input.bankName,
            account_number: input.accountNumber,
            account_name: resolved.account_name,
            percentage_charge: fee,
            updated_at: new Date().toISOString(),
          });
          if (error) throw error;
          return Response.json({ ok: true, accountName: resolved.account_name });
        } catch (error) {
          console.error(error);
          const message = error instanceof Error && /resolve|account/i.test(error.message)
            ? "We couldn't confirm that bank account. Check the number and bank."
            : "Could not save your bank account. Please try again.";
          return Response.json({ ok: false, error: message }, { status: 502 });
        }
      },
    },
  },
});
