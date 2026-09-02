"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { Button, Screen } from "@/components/ui";

const KEY = "vx.lastSlot";

export function SetupClient({ deckSize, due }: { deckSize: number; due: number }) {
  const router = useRouter();
  const [custom, setCustom] = useState("");
  const [stored, setStored] = useLocalStorage(KEY);
  const last = Number(stored) > 0 ? Number(stored) : null;

  const presets = [10, 15, 20].filter((n) => n < deckSize);
  const options = [...presets, deckSize > presets[presets.length - 1] ? deckSize : null].filter(
    (n): n is number => n !== null,
  );

  function start(slot: number) {
    const n = Math.min(Math.max(1, slot), deckSize);
    setStored(String(n));
    router.push(`/session?mode=due&slot=${n}`);
  }

  return (
    <Screen className="px-6 pt-10">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-text-dim">
          ←
        </Link>
        <h1 className="text-xl font-bold">How many words today?</h1>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3">
        {options.map((n) => (
          <button
            key={n}
            onClick={() => start(n)}
            className={`rounded-2xl border py-6 text-xl font-semibold ${
              last === n ? "border-accent bg-accent/10" : "border-border bg-surface"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (Number(custom) > 0) start(Number(custom));
        }}
      >
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          placeholder="Custom"
          className="flex-1 rounded-2xl border border-border bg-surface px-4 py-3 outline-none focus:border-accent"
        />
        <Button type="submit" className="w-auto px-5" disabled={!custom}>
          Go
        </Button>
      </form>

      <p className="mt-6 text-text-dim">{due} words due</p>

      <div className="mt-auto safe-b">
        <Button onClick={() => start(last ?? presets[0] ?? deckSize)}>Start</Button>
      </div>
    </Screen>
  );
}
