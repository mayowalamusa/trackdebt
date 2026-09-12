import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

function config() {
  const url = process.env["SUPABASE_URL"];
  const anonKey = process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !anonKey || !serviceRoleKey) return null;
  return { url, anonKey, serviceRoleKey };
}

export function createSupabaseAdmin(): SupabaseClient | null {
  const values = config();
  if (!values) return null;
  return createClient(values.url, values.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function accessTokenFromRequest(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

export async function userFromRequest(request: Request): Promise<User | null> {
  const token = accessTokenFromRequest(request);
  return userFromAccessToken(token);
}

export async function userFromAccessToken(token: string | null): Promise<User | null> {
  const values = config();
  if (!values || !token) return null;
  const authClient = createClient(values.url, values.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  return error ? null : data.user;
}

export function requireSupabaseAdmin(): SupabaseClient {
  const client = createSupabaseAdmin();
  if (!client) throw new Error("Supabase server configuration is incomplete.");
  return client;
}