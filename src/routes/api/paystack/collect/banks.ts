import { createFileRoute } from "@tanstack/react-router";
import { paystackApi, requirePlusUser } from "@/lib/paystack-collect.server";

export const Route = createFileRoute("/api/paystack/collect/banks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requirePlusUser(request);
        if (auth instanceof Response) return auth;
        try {
          const banks = await paystackApi<{ name: string; code: string }[]>("/bank?country=nigeria&currency=NGN&perPage=200");
          return Response.json({ ok: true, banks: banks.map((b) => ({ name: b.name, code: b.code })) });
        } catch (error) {
          console.error(error);
          return Response.json({ ok: false, error: "Could not load banks." }, { status: 502 });
        }
      },
    },
  },
});
