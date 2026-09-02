import { redirect } from "next/navigation";
import { getDeck } from "@/lib/data";
import { dueCount } from "@/lib/session";
import { SetupClient } from "./SetupClient";

export const dynamic = "force-dynamic";

export default async function SessionSetupPage() {
  const deck = await getDeck();
  if (deck.length === 0) redirect("/add");
  if (deck.length < 10) redirect("/session?mode=due");

  return <SetupClient deckSize={deck.length} due={dueCount(deck)} />;
}
