"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

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
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-10 px-6 text-center safe-b">
      <div>
        <div className="font-serif text-[40px] font-medium tracking-[-0.02em]">VX Card</div>
        <p className="mt-2 text-text-dim">Vocabulary, one word at a time.</p>
      </div>
      <div className="w-full">
        <Button onClick={signIn} disabled={busy}>
          {busy ? "Opening Google…" : "Continue with Google"}
        </Button>
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      </div>
    </div>
  );
}
