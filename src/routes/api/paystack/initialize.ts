import { createFileRoute } from "@tanstack/react-router";
import { initializePlusCheckout } from "@/lib/paystack.server";
import { createSupabaseAdmin, userFromRequest } from "@/lib/supabase.server";

export const Route = createFileRoute("/api/paystack/initialize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await userFromRequest(request);
        if (!user?.email) return Response.json({ ok: false, error: "Sign in to upgrade." }, { status: 401 });
        if (!createSupabaseAdmin()) return Response.json({ ok: false, error: "Billing is not configured." }, { status: 503 });

        try {
          const callbackUrl = process.env["PAYSTACK_CALLBACK_URL"] ?? new URL("/upgrade", request.url).toString();
          const checkout = await initializePlusCheckout({ email: user.email, userId: user.id, callbackUrl });
          return Response.json({ ok: true, ...checkout });
        } catch (error) {
          console.error(error);
          return Response.json({ ok: false, error: "Could not start Paystack checkout." }, { status: 502 });
        }
      },
    },
  },
});