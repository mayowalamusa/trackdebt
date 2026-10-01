import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/manage")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
});
