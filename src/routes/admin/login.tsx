import { isValidEmail } from "@/lib/input-validation";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [{ title: "Admin Login — Track Debt" }],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const result = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", result.data.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!role) {
      await supabase.auth.signOut();
      setError("Not authorised. This account does not have admin access.");
      setLoading(false);
      return;
    }

    navigate({ to: "/admin" });
  }

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-2xl border bg-background p-6 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-medium text-primary">Track Debt</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Admin sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with an account that has administrator access.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="admin@example.com"
              aria-describedby="admin-email-help"
              className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span id="admin-email-help" className="mt-1.5 block text-xs text-muted-foreground">Enter a valid administrator email address.</span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Password</span>
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="mt-1.5 block text-xs text-muted-foreground">Enter the password for your administrator account.</span>
          </label>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            disabled={loading || !isValidEmail(email) || !password.length}
            className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
