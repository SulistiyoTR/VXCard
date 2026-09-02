"use client";

import { redirect } from "next/navigation";
import { dueCount } from "@/lib/session";
import { useAppData } from "@/lib/store/provider";
import { Screen } from "@/components/ui";
import { SetupClient } from "./SetupClient";

export default function SessionSetupPage() {
  const { deck, ready } = useAppData();

  if (!ready) {
    return (
      <Screen className="items-center justify-center">
        <p className="text-text-dim">Loading…</p>
      </Screen>
    );
  }
  if (deck.length === 0) redirect("/add");
  if (deck.length < 10) redirect("/session?mode=due");

  return <SetupClient deckSize={deck.length} due={dueCount(deck)} />;
}
