/** Centralised env access with friendly errors. */

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}. See SETUP.md.`);
  return v;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  anthropicKey: () => required("ANTHROPIC_API_KEY"),
  /** Optional override; defaults to Haiku (SPEC 1.3). */
  llmModel: () => process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
};

export const hasSupabaseConfig = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
