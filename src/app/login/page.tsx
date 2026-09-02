"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Screen } from "@/components/ui";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setBusy(false);
    }
  }

  return (
    <Screen className="items-center justify-center gap-8 px-6">
      <div className="text-center">
        <div className="text-4xl font-bold tracking-tight">VX Card</div>
        <p className="mt-2 text-text-dim">Vocabulary, one word at a time.</p>
      </div>
      <div className="w-full">
        <Button onClick={signIn} disabled={busy}>
          {busy ? "Opening Google…" : "Continue with Google"}
        </Button>
        {error && <p className="mt-3 text-center text-sm text-bad">{error}</p>}
      </div>
    </Screen>
  );
}
