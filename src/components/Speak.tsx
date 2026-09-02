"use client";

/** 🔊 button — plays the dictionary audio, falling back to speechSynthesis (SPEC 1.2). */
export function Speak({ word, audioUrl }: { word: string; audioUrl: string | null }) {
  function play() {
    if (audioUrl) {
      const a = new Audio(audioUrl);
      a.play().catch(() => speak(word));
      return;
    }
    speak(word);
  }
  return (
    <button
      type="button"
      onClick={play}
      aria-label={`Pronounce ${word}`}
      className="rounded-full px-2 py-1 text-lg active:bg-surface-2"
    >
      🔊
    </button>
  );
}

function speak(word: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(word);
  u.lang = "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
