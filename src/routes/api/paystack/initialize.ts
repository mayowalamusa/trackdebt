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
          // Never derive the callback URL from the incoming request — a caller
          // could spoof the host and steer post-payment redirects elsewhere.
          const callbackUrl = process.env["PAYSTACK_CALLBACK_URL"];
          if (!callbackUrl) {
            return Response.json({ ok: false, error: "Billing is not configured." }, { status: 503 });
          }
          let parsed: URL;
          try {
            parsed = new URL(callbackUrl);
          } catch {
            return Response.json({ ok: false, error: "Billing is not configured." }, { status: 503 });
          }
          if (parsed.protocol !== "https:") {
            return Response.json({ ok: false, error: "Billing is not configured." }, { status: 503 });
          }
          const checkout = await initializePlusCheckout({ email: user.email, userId: user.id, callbackUrl: parsed.toString() });
          return Response.json({ ok: true, ...checkout });
        } catch (error) {
          console.error(error);
          return Response.json({ ok: false, error: "Could not start Paystack checkout." }, { status: 502 });
        }
      },
    },
  },
});