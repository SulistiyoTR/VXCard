import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client — bypasses RLS. Server-only. Used for writes the client
 * can't make directly: shared `words` content (SPEC 1.1 / 5.10), the `mw_lookups`
 * counter, and the cron reminder job (SPEC 6.3).
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
