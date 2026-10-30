import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false } };

let authClient: SupabaseClient | null = null;
let admin: SupabaseClient | null = null;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} missing`);
  return value;
}

/** Anon-key client: enough to verify a user's access token (least privilege). */
export function supabaseAuth(): SupabaseClient {
  authClient ??= createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), NO_SESSION);
  return authClient;
}

/** Service-role client: server code only (spec §5), used by the seed to create demo accounts. */
export function supabaseAdmin(): SupabaseClient {
  admin ??= createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), NO_SESSION);
  return admin;
}
