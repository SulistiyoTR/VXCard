"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

const STEPS = [
  {
    img: "/onboarding/save-word.png",
    title: "Save a word",
    body: "Add vocabulary you want to remember.",
  },
  {
    img: "/onboarding/play-quiz.png",
    title: "Play the quiz",
    body: "Learn, practice, and remember your words.",
  },
  {
    img: "/onboarding/repeat-daily.png",
    title: "Repeat daily",
    body: "Remember more and keep your streak alive.",
  },
] as const;

function Step({ n, img, title, body }: { n: number } & (typeof STEPS)[number]) {
  return (
    <div className="space-y-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative onboarding art */}
      <img src={img} alt="" className="mx-auto block h-11 w-auto opacity-60" />
      <div className="flex items-center gap-3">
        <span
          className="relative grid h-7 w-7 shrink-0 place-items-center text-text-faint"
          style={{
            background:
              "radial-gradient(circle at 50% 120%, rgba(0,0,0,0.55), transparent 55%)",
          }}
        >
          <svg viewBox="0 0 32 32" fill="none" className="absolute inset-0 h-full w-full">
            <circle
              cx="16"
              cy="16"
              r="13.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="72 16"
              strokeDashoffset="28"
            />
          </svg>
          <span className="font-serif text-[13px] font-medium leading-none text-text">{n}</span>
        </span>
        <div>
          <h3 className="font-serif text-[17px] font-medium leading-tight tracking-[-0.005em]">
            {title}
          </h3>
          <p className="mt-0.5 text-[13.5px] leading-snug text-text-dim">{body}</p>
        </div>
      </div>
    </div>
  );
}

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
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-6 px-6 py-8 safe-b">
      {/* Header + first step, pinned to the bottom of the top half. */}
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-8">
        <header className="text-center">
          <div className="font-serif text-[40px] font-medium tracking-[-0.02em]">VX Card</div>
          <p className="mt-2 text-[15px] text-text-dim">
            Build vocabulary that you&rsquo;ll remember.
          </p>
          <div className="mt-6 h-px w-full bg-white/25" />
        </header>
        <Step n={1} {...STEPS[0]} />
      </div>

      {/* Always the vertical centre of the screen. */}
      <Step n={2} {...STEPS[1]} />

      {/* Last step, then the way in — pinned to the top of the bottom half. */}
      <div className="flex min-h-0 flex-1 flex-col justify-start gap-8">
        <Step n={3} {...STEPS[2]} />
        <div>
          <Button onClick={signIn} disabled={busy}>
            {busy ? "Opening Google…" : "Continue with Google"}
          </Button>
          {error && <p className="mt-3 text-center text-sm text-bad">{error}</p>}
        </div>
      </div>
    </div>
  );
}
