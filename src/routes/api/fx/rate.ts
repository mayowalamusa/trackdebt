import { createFileRoute } from "@tanstack/react-router";
import { isCurrencyCode } from "@/lib/currency/currencies";

export const Route = createFileRoute("/api/fx/rate")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const from = url.searchParams.get("from")?.toUpperCase() ?? "";
          const to = url.searchParams.get("to")?.toUpperCase() ?? "";
          if (!isCurrencyCode(from) || !isCurrencyCode(to)) {
            return Response.json({ error: "Unsupported currency." }, { status: 400 });
          }
          if (from === to) return Response.json({ rate: 1, date: new Date().toISOString() });

          const response = await fetch(
            `https://api.frankfurter.dev/v2/rate/${from}/${to}`,
            { headers: { Accept: "application/json" } },
          );
          if (!response.ok) return Response.json({ error: "Exchange rate unavailable." }, { status: 502 });

          const data = (await response.json()) as { rate?: number; date?: string; base?: string; quote?: string };
          if (!data.rate || !Number.isFinite(data.rate) || data.rate <= 0) {
            return Response.json({ error: "Invalid exchange rate." }, { status: 502 });
          }

          return Response.json({
            rate: data.rate,
            date: data.date ?? new Date().toISOString(),
            base: data.base ?? from,
            quote: data.quote ?? to,
            provider: "Frankfurter",
          }, {
            headers: { "Cache-Control": "public, max-age=86400" },
          });
        } catch {
          return Response.json({ error: "Exchange rate service unavailable." }, { status: 503 });
        }
      },
    },
  },
});
