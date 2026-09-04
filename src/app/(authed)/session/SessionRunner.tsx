"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CONFIG } from "@/lib/config";
import { daysBetween, today } from "@/lib/date";
import { buildQuestion, hintBudget, hintMask, matchTyped, nextHintPosition, quizLevel, type Question } from "@/lib/quiz";
import { buildPracticeSession } from "@/lib/session";
import { scoreAnswer, updateCard, updateCardHardMode } from "@/lib/scheduler";
import { useAppData } from "@/lib/store/provider";
import type { CardState, ReviewResult, SessionItem, SessionRow, Word } from "@/lib/types";
import { Button, Dots, SectionLabel } from "@/components/ui";
import { WordPackage } from "@/components/WordPackage";
import {
  IconCheck,
  IconClose,
  IconPencil,
  IconPending,
  IconSlow,
} from "@/components/icons";

function newSessionRow(planned: number, source: SessionRow["source"]): SessionRow {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    started_at: now,
    finished_at: null,
    completed: false,
    planned,
    answered: 0,
    source,
    updated_at: now,
  };
}

interface Entry {
  item: SessionItem;
  question: Question;
}

interface Outcome {
  entry: Entry;
  result: ReviewResult;
  durationMs: number;
  helpUsed: number;
  typedAnswer?: string;
  almost?: boolean;
  oldLevel: number;
  newState: CardState;
}

type Phase = "question" | "feedback" | "done";

export function SessionRunner({
  entries: initialEntries,
  deck,
  hardMode,
}: {
  entries: Entry[];
  deck: Word[];
  hardMode: boolean;
}) {
  const router = useRouter();
  const { patchWord, recordReview, upsertSession, bumpSentenceUsage } = useAppData();
  const planned = initialEntries.length;

  const sessionRef = useRef<SessionRow>(
    newSessionRow(planned, hardMode ? "hardmode" : "mixed"),
  );
  const [queue, setQueue] = useState<Entry[]>(initialEntries);
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState<Phase>("question");
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [last, setLast] = useState<Outcome | null>(null);
  const [quitEarly, setQuitEarly] = useState(false);
  const [showQuit, setShowQuit] = useState(false);

  const startRef = useRef(0);
  useEffect(() => {
    startRef.current = Date.now();
    void upsertSession(sessionRef.current);
  }, [upsertSession]);
  const demotionsRef = useRef(0);
  const requeued = useRef<Set<string>>(new Set());
  const usageBumped = useRef<Set<number>>(new Set());
  const ticketsRan = useRef(false);

  const entry = queue[pos];

  // `sentence_usage` goes up when a level 3/4 sentence is *shown* (SPEC 1.6),
  // not when it's answered — so this fires once per queue position.
  useEffect(() => {
    if (phase !== "question" || !entry) return;
    const idx = entry.question.sentenceIndex;
    if (idx == null || usageBumped.current.has(pos)) return;
    usageBumped.current.add(pos);
    void bumpSentenceUsage(entry.item.word.id, idx);
  }, [pos, phase, entry, bumpSentenceUsage]);

  // After the results screen renders, kick the sentence-pool ticket system in
  // the background (SPEC 1.6 / UPDATE-PLAN Sesi 5). Fire-and-forget — the
  // results screen never waits on it.
  useEffect(() => {
    if (phase !== "done" || ticketsRan.current) return;
    ticketsRan.current = true;
    // Words whose sentence pool was actually touched this session — i.e. a cloze
    // question was built for them (levels 3-4, or Hard Mode).
    const wordIds = [
      ...new Set(
        outcomes
          .filter((o) => o.entry.question.sentenceIndex != null)
          .map((o) => o.entry.item.word.id),
      ),
    ];
    if (wordIds.length === 0) return;
    void fetch("/api/tickets/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ word_ids: wordIds }),
    }).catch(() => {});
  }, [phase, outcomes]);

  const persistSession = useCallback(
    (answered: number, completed: boolean) => {
      const row: SessionRow = {
        ...sessionRef.current,
        answered,
        completed,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      sessionRef.current = row;
      void upsertSession(row);
    },
    [upsertSession],
  );

  const record = useCallback(
    (result: ReviewResult, helpUsed: number, extra: { typedAnswer?: string; almost?: boolean } = {}) => {
      const durationMs = Date.now() - startRef.current;
      const word = entry.item.word;
      const cardState: CardState = {
        level: word.level,
        streak: word.streak,
        due_date: word.due_date,
        lapse_count: word.lapse_count,
      };

      let newState: CardState;
      if (hardMode) {
        const res = updateCardHardMode(cardState, result, demotionsRef.current);
        if (res.demoted) demotionsRef.current += 1;
        newState = res.card;
      } else {
        newState = updateCard(cardState, result);
      }

      const outcome: Outcome = {
        entry,
        result,
        durationMs,
        helpUsed,
        oldLevel: word.level,
        newState,
        ...extra,
      };
      setLast(outcome);
      setOutcomes((o) => [...o, outcome]);
      setPhase("feedback");

      // Local write — the store queues the sync (SPEC 5.5 / 6.4).
      void patchWord(word.id, {
        level: newState.level,
        streak: newState.streak,
        due_date: newState.due_date,
        lapse_count: newState.lapse_count,
        last_seen_date: today(),
        review_count: word.review_count + 1,
      });
      void recordReview({
        id: crypto.randomUUID(),
        word_id: word.id,
        reviewed_at: new Date().toISOString(),
        level: quizLevel(word.level),
        result,
        duration_ms: Math.min(durationMs, 120_000),
        help_used: helpUsed,
        source: entry.item.source,
      });

      // Wrong words come back once at the end of the session (SPEC 2.7).
      if ((result === "wrong" || result === "dontknow") && !requeued.current.has(word.id)) {
        requeued.current.add(word.id);
        setQueue((q) => [...q, { item: entry.item, question: buildQuestion(word, quizLevel(word.level), deck) }]);
      }
    },
    [entry, hardMode, deck, patchWord, recordReview],
  );

  function answerChoice(choice: string) {
    record(
      scoreAnswer({
        correct: choice === entry.question.answer,
        dontKnow: false,
        durationMs: Date.now() - startRef.current,
        level: quizLevel(entry.item.word.level),
        helpUsed: 0,
      }),
      0,
    );
  }

  function answerTyped(input: string, helpUsed: number) {
    const verdict = matchTyped(input, entry.question.answer);
    const correct = verdict !== "wrong";
    record(
      scoreAnswer({
        correct,
        dontKnow: false,
        durationMs: Date.now() - startRef.current,
        level: 4,
        helpUsed,
      }),
      helpUsed,
      { typedAnswer: input, almost: verdict === "almost" },
    );
  }

  function dontKnow() {
    record("dontknow", 0);
  }

  function next() {
    if (pos + 1 >= queue.length) {
      setPhase("done");
      persistSession(outcomes.length, !quitEarly);
      return;
    }
    setPos((p) => p + 1);
    setPhase("question");
    startRef.current = Date.now();
  }

  function confirmQuit() {
    setQuitEarly(true);
    setShowQuit(false);
    setPhase("done");
    persistSession(outcomes.length, false);
  }

  function practiceMore() {
    const seen = [...new Set(outcomes.map((o) => o.entry.item.word.id))];
    const items = buildPracticeSession(deck, planned, seen);
    if (items.length === 0) return;
    const fresh = items.map((item) => ({
      item,
      question: buildQuestion(item.word, quizLevel(item.word.level), deck),
    }));
    sessionRef.current = newSessionRow(fresh.length, "practice");
    void upsertSession(sessionRef.current);
    setQueue(fresh);
    setPos(0);
    setOutcomes([]);
    setLast(null);
    setQuitEarly(false);
    demotionsRef.current = 0;
    requeued.current = new Set();
    usageBumped.current = new Set();
    ticketsRan.current = false;
    startRef.current = Date.now();
    setPhase("question");
  }

  if (phase === "done") {
    return (
      <CompleteView
        outcomes={outcomes}
        quitEarly={quitEarly}
        onDone={() => router.push("/")}
        onPractice={practiceMore}
        canPractice={buildPracticeSession(deck, planned, [
          ...new Set(outcomes.map((o) => o.entry.item.word.id)),
        ]).length > 0}
      />
    );
  }

  const answered = outcomes.length;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-4 safe-t">
      <div className="flex items-center gap-3.5">
        <button
          onClick={() => setShowQuit(true)}
          className="text-xl leading-none text-text-dim"
          aria-label="Quit session"
        >
          <IconClose />
        </button>
        <div className="h-[5px] flex-1 overflow-hidden border border-border bg-surface-2">
          <div
            className="h-full bg-text transition-[width] duration-[380ms] [transition-timing-function:var(--spring)]"
            style={{ width: `${(answered / planned) * 100}%` }}
          />
        </div>
        <span className="text-sm tabular-nums text-text-faint">
          {Math.min(answered + 1, planned)} / {planned}
        </span>
      </div>

      {phase === "question" ? (
        <QuestionView
          key={pos}
          question={entry.question}
          onChoice={answerChoice}
          onTyped={answerTyped}
          onDontKnow={dontKnow}
        />
      ) : last ? (
        <FeedbackView outcome={last} hardMode={hardMode} onContinue={next} />
      ) : null}

      {showQuit && (
        <div className="fixed inset-0 z-20 flex items-end bg-black/60 p-5 safe-b">
          <div className="w-full rounded-[var(--r-card)] border border-border border-t-2 border-t-border-strong bg-surface p-5">
            <p className="font-serif text-xl font-bold">Quit session?</p>
            <p className="mt-1 text-sm text-text-dim">
              Your {answered} answers are saved, but your streak won&rsquo;t count today.
            </p>
            <div className="mt-4 space-y-2">
              <Button variant="secondary" onClick={() => setShowQuit(false)}>
                Keep going
              </Button>
              <Button variant="danger" onClick={confirmQuit}>
                Quit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Question */

const ANSWER_LABEL: Record<number, string> = {
  1: "Choose the meaning",
  2: "Which word?",
  3: "Fill the blank",
  4: "Type the word",
};

function QuestionView({
  question,
  onChoice,
  onTyped,
  onDontKnow,
}: {
  question: Question;
  onChoice: (c: string) => void;
  onTyped: (input: string, helpUsed: number) => void;
  onDontKnow: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState<number[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const budget = hintBudget(question.answer);
  const decided = chosen !== null;

  function hint() {
    if (revealed.length >= budget) return;
    const p = nextHintPosition(question.answer, revealed);
    if (p >= 0) setRevealed((r) => [...r, p]);
  }

  // Let the chosen option's state read for a beat before the feedback slides in.
  function choose(opt: string) {
    if (decided) return;
    setChosen(opt);
    setTimeout(() => onChoice(opt), 460);
  }

  const prompt =
    question.level === 3 ? (
      <p className="font-serif text-[21px] leading-relaxed text-text">{question.sentence}</p>
    ) : question.level === 2 ? (
      <p className="max-w-xs font-serif text-[20px] leading-snug text-text">{question.prompt}</p>
    ) : (
      <p className="font-serif text-[44px] font-bold leading-none tracking-[-0.015em]">
        {question.prompt}
      </p>
    );

  return (
    <div className="slide-in flex flex-1 flex-col pt-8">
      <div className="flex flex-1 flex-col items-center justify-center px-2 text-center">
        {question.level === 4 ? (
          <>
            <p className="font-serif text-[19px] leading-relaxed text-text">{question.sentence}</p>
            <div className="mt-6 font-mono text-xl tracking-[0.3em] text-text-dim">
              {hintMask(question.answer, revealed)}
            </div>
          </>
        ) : (
          prompt
        )}
      </div>

      <div className="safe-b">
        <div className="mb-3 mt-3.5">
          <SectionLabel>{ANSWER_LABEL[question.level]}</SectionLabel>
        </div>

        {question.level === 4 ? (
          <form
            className="space-y-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim()) onTyped(typed, revealed.length);
            }}
          >
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="done"
              className="w-full rounded-[var(--r-input)] border border-border bg-surface px-4 py-4 text-center font-serif text-[22px] outline-none focus:border-accent"
            />
            <div className="flex gap-2.5">
              <Button
                type="button"
                variant="secondary"
                className="w-auto flex-1"
                onClick={hint}
                disabled={revealed.length >= budget}
              >
                Hint · {budget - revealed.length}
              </Button>
              <Button type="submit" className="w-auto flex-1" disabled={!typed.trim()}>
                Answer
              </Button>
            </div>
            <button
              type="button"
              onClick={onDontKnow}
              className="mx-auto block py-2 text-sm text-text-faint"
            >
              Don&rsquo;t know
            </button>
          </form>
        ) : (
          <>
            <div className={`options flex flex-col gap-2.5 ${decided ? "decided" : ""}`}>
              {question.options.map((opt) => (
                <button
                  key={opt}
                  disabled={decided}
                  onClick={() => choose(opt)}
                  className={`opt w-full ${chosen === opt ? "chosen" : ""}`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <button
              onClick={onDontKnow}
              disabled={decided}
              className="mx-auto mt-3.5 block py-2 text-sm text-text-faint disabled:opacity-40"
            >
              Don&rsquo;t know
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Feedback */

// Informative, never punishing (SPEC §2) — a miss reads in dimmed text, not red.
function topLine(o: Outcome): { icon: ReactNode; text: string; className: string } {
  const secs = (o.durationMs / 1000).toFixed(1);
  switch (o.result) {
    case "correct":
      return { icon: <IconCheck />, text: `Correct · ${secs}s`, className: "text-good" };
    case "slow":
      return o.helpUsed > 0
        ? { icon: <IconSlow />, text: `Correct, used ${o.helpUsed} hint${o.helpUsed > 1 ? "s" : ""}`, className: "text-slow" }
        : { icon: <IconSlow />, text: `Correct, but slow · ${secs}s`, className: "text-slow" };
    case "wrong":
      return { icon: <IconClose />, text: "Not quite", className: "text-text-dim" };
    case "dontknow":
      return { icon: <IconPending />, text: "Not yet — that's fine", className: "text-text-dim" };
  }
}

function FeedbackView({
  outcome,
  hardMode,
  onContinue,
}: {
  outcome: Outcome;
  hardMode: boolean;
  onContinue: () => void;
}) {
  const word = outcome.entry.item.word;
  const { hideSentence } = useAppData();
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const line = topLine(outcome);

  const shownIndex = outcome.entry.question.sentenceIndex ?? 0;
  const shown = word.sentences[shownIndex];
  const shownSentence = shown ? [shown] : word.sentences.slice(0, 1);

  const days = daysBetween(today(), outcome.newState.due_date);
  const dueLabel = days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;

  // "Change this sentence" (SPEC 1.6): hide for this user + queue the global
  // hide_count bump. The pool is append-only — nothing is regenerated.
  async function changeSentence() {
    if (!shown || hidden) return;
    setBusy(true);
    try {
      await hideSentence(word.id, shownIndex);
      setHidden(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="slide-in flex flex-1 flex-col pt-6">
      <div className={`flex items-center gap-2 text-base font-semibold ${line.className}`}>
        {line.icon}
        <span>{line.text}</span>
      </div>
      {outcome.result === "wrong" && outcome.typedAnswer && (
        <div className="mt-1 text-sm text-text-dim">
          Your answer:{" "}
          <span className="underline decoration-text-faint underline-offset-2">
            {outcome.typedAnswer}
          </span>
        </div>
      )}
      {outcome.almost && (
        <div className="mt-1 text-sm text-slow">
          Almost — it&rsquo;s spelled {outcome.entry.question.answer}
        </div>
      )}

      <div className="my-[18px] h-px bg-border" />

      <WordPackage
        word={word.word}
        phonetic={word.phonetic}
        audioUrl={word.audio_url}
        pos={word.pos}
        definition={word.definition}
        origin={word.origin}
        otherMeanings={word.other_meanings}
        sentences={shownSentence}
      />

      <div className="my-[18px] h-px bg-border" />

      <div className="flex items-center justify-between text-sm">
        <LevelIndicator oldLevel={outcome.oldLevel} newState={outcome.newState} />
        {!hardMode && <span className="text-text-dim">{dueLabel}</span>}
      </div>
      {shown &&
        (hidden ? (
          <span className="mt-2 self-end text-[12.5px] text-text-faint">
            Hidden — you won&rsquo;t see this one again
          </span>
        ) : (
          <button
            onClick={changeSentence}
            disabled={busy}
            className="mt-2 inline-flex items-center gap-1 self-end text-[12.5px] text-accent disabled:opacity-40"
          >
            <IconPencil /> {busy ? "…" : "change sentence"}
          </button>
        ))}

      <div className="mt-auto pt-6 safe-b">
        <Button onClick={onContinue}>Continue</Button>
      </div>
    </div>
  );
}

function LevelIndicator({ oldLevel, newState }: { oldLevel: number; newState: CardState }) {
  const target = CONFIG.LEVEL_TARGETS[newState.level] ?? 3;
  return (
    <span className="inline-flex items-center gap-1.5 text-text-dim">
      {newState.level >= 5 ? (
        <span className="inline-flex items-center gap-1.5 text-good">
          <IconCheck /> Finished
        </span>
      ) : (
        <>
          <span>Level {newState.level}</span>
          <span className="text-text">
            <Dots filled={newState.streak} total={target} />
          </span>
          {newState.level !== oldLevel && (
            <span className={newState.level > oldLevel ? "text-good" : "text-slow"}>
              ({oldLevel} → {newState.level})
            </span>
          )}
        </>
      )}
    </span>
  );
}

/* ---------------------------------------------------------------- Complete */

function CompleteView({
  outcomes,
  quitEarly,
  onDone,
  onPractice,
  canPractice,
}: {
  outcomes: Outcome[];
  quitEarly: boolean;
  onDone: () => void;
  onPractice: () => void;
  canPractice: boolean;
}) {
  const good = outcomes.filter((o) => o.result === "correct").length;
  const slow = outcomes.filter((o) => o.result === "slow").length;
  const bad = outcomes.filter((o) => o.result === "wrong" || o.result === "dontknow").length;

  const ups = outcomes.filter((o) => o.newState.level > o.oldLevel);
  const downs = outcomes.filter((o) => o.newState.level < o.oldLevel);
  const allCorrect = bad === 0 && slow === 0 && outcomes.length > 0;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-16 safe-b">
      <div className="text-center">
        <h1 className="font-serif text-[26px] font-bold tracking-[-0.005em]">
          {quitEarly ? "Session stopped" : "Session complete"}
        </h1>
      </div>

      <div className="mt-6 flex justify-center gap-7 text-lg tabular-nums">
        <span className="inline-flex items-center gap-1.5 text-good">
          <IconCheck /> {good}
        </span>
        <span className="inline-flex items-center gap-1.5 text-slow">
          <IconSlow /> {slow}
        </span>
        <span className="inline-flex items-center gap-1.5 text-text-dim">
          <IconClose /> {bad}
        </span>
      </div>

      {allCorrect && <p className="mt-3 text-center text-good">Nice — all correct</p>}

      {ups.length > 0 && (
        <Section title="Level up">
          {ups.map((o, i) => (
            <Row key={i} word={o.entry.item.word.word} from={o.oldLevel} to={o.newState.level} />
          ))}
        </Section>
      )}
      {downs.length > 0 && (
        <Section title="Needs review">
          {downs.map((o, i) => (
            <Row key={i} word={o.entry.item.word.word} from={o.oldLevel} to={o.newState.level} />
          ))}
        </Section>
      )}

      <div className="mt-auto space-y-2 pt-8">
        {canPractice && (
          <Button variant="secondary" onClick={onPractice}>
            Practice more
          </Button>
        )}
        <Button variant="ghost" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-2 space-y-1">{children}</div>
    </div>
  );
}

function Row({ word, from, to }: { word: string; from: number; to: number }) {
  return (
    <div className="flex justify-between">
      <span>{word}</span>
      <span className="text-text-dim">
        L{from} → L{to}
      </span>
    </div>
  );
}

