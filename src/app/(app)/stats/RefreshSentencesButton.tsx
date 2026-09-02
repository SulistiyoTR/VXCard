"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { refreshStaleSentences } from "@/lib/actions";
import { Button } from "@/components/ui";

export function RefreshSentencesButton({ ready }: { ready: number }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "confirm" | "running" | "done">("idle");
  const [done, setDone] = useState(0);

  if (state === "confirm") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-text-dim">{ready} words will be refreshed.</p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setState("idle")}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={async () => {
              setState("running");
              const res = await refreshStaleSentences();
              setDone(res.refreshed);
              setState("done");
              router.refresh();
            }}
          >
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  if (state === "running") {
    return <p className="text-sm text-text-dim">Refreshing sentences in the background…</p>;
  }

  if (state === "done") {
    return <p className="text-sm text-good">Refreshed {done} words.</p>;
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" onClick={() => setState("confirm")}>
        Refresh sentences
      </Button>
      <p className="text-center text-sm text-text-faint">{ready} words ready</p>
    </div>
  );
}
