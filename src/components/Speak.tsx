"use client";

import { useState } from "react";
import { IconSound } from "./icons";

/**
 * Speaker button — plays the dictionary audio, falling back to speechSynthesis
 * (SPEC 1.2). Disabled while loading/playing so a double-tap can't stack two
 * plays on top of each other.
 */
export function Speak({ word, audioUrl }: { word: string; audioUrl: string | null }) {
  const [busy, setBusy] = useState(false);

  function play() {
    if (busy) return;
    setBusy(true);
    const done = () => setBusy(false);

    if (audioUrl) {
      const a = new Audio(audioUrl);
      a.addEventListener("ended", done);
      a.addEventListener("error", done);
      a.play().catch(() => speak(word, done));
      return;
    }
    speak(word, done);
  }

  return (
    <button
      type="button"
      onClick={play}
      disabled={busy}
      aria-label={`Pronounce ${word}`}
      className="rounded-full p-1.5 text-base text-text-dim active:bg-surface-2 disabled:opacity-40"
    >
      <IconSound />
    </button>
  );
}

function speak(word: string, onDone: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onDone();
    return;
  }
  const u = new SpeechSynthesisUtterance(word);
  u.lang = "en-US";
  u.onend = onDone;
  u.onerror = onDone;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
