/**
 * Centralised env access with friendly errors.
 *
 * NEXT_PUBLIC_* vars MUST be read as static `process.env.NEXT_PUBLIC_FOO`
 * member expressions — Next.js only inlines those into the client bundle.
 * Dynamic access (`process.env[name]`) yields `undefined` in the browser.
 */

function need(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var ${name}. See SETUP.md.`);
  return value;
}

export const env = {
  supabaseUrl: () => need("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () =>
    need("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  supabaseServiceKey: () =>
    need("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  anthropicKey: () => need("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY),
  /** Optional override; defaults to Haiku (SPEC 1.3). */
  llmModel: () => process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  vapidPublic: () => need("NEXT_PUBLIC_VAPID_PUBLIC_KEY", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
  vapidPrivate: () => need("VAPID_PRIVATE_KEY", process.env.VAPID_PRIVATE_KEY),
  vapidSubject: () => process.env.VAPID_SUBJECT || "mailto:admin@example.com",
  cronSecret: () => need("CRON_SECRET", process.env.CRON_SECRET),
};

export const hasSupabaseConfig = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
