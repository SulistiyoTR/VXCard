"use client";

import { useState } from "react";
import { refreshSentences } from "@/lib/actions";
import { useAppData } from "@/lib/store/provider";
import { Button } from "@/components/ui";

interface Subject {
  id: string;
  word: string;
  pos: string;
  definition: string;
}

export function RefreshSentencesButton({
  subjects,
  disabled,
}: {
  subjects: Subject[];
  disabled?: boolean;
}) {
  const { patchWord } = useAppData();
  const [state, setState] = useState<"idle" | "confirm" | "running" | "done">("idle");
  const [done, setDone] = useState(0);

  async function run() {
    setState("running");
    const results = await refreshSentences(subjects);
    for (const r of results) {
      await patchWord(r.id, { sentences: r.sentences });
    }
    setDone(results.length);
    setState("done");
  }

  if (state === "confirm") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-text-dim">{subjects.length} words will be refreshed.</p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setState("idle")}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={run}>
            Refresh
          </Button>
        </div>
      </div>
    );
  }
  if (state === "running") return <p className="text-sm text-text-dim">Refreshing sentences…</p>;
  if (state === "done") return <p className="text-sm text-good">Refreshed {done} words.</p>;

  return (
    <div className="space-y-2">
      <Button variant="secondary" onClick={() => setState("confirm")} disabled={disabled}>
        Refresh sentences
      </Button>
      <p className="text-center text-sm text-text-faint">
        {subjects.length} words ready{disabled ? " · needs a connection" : ""}
      </p>
    </div>
  );
}
