"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createSession, finishSession, regenerateSentence, submitAnswer } from "@/lib/actions";
import { CONFIG } from "@/lib/config";
import { daysBetween, today } from "@/lib/date";
import { buildQuestion, hintBudget, hintMask, matchTyped, nextHintPosition, quizLevel, type Question } from "@/lib/quiz";
import { buildPracticeSession } from "@/lib/session";
import { scoreAnswer, updateCard, updateCardHardMode } from "@/lib/scheduler";
import type { CardState, ReviewResult, SessionItem, Word } from "@/lib/types";
import { Button } from "@/components/ui";
import { WordPackage } from "@/components/WordPackage";

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
  sessionId: initialSessionId,
  entries: initialEntries,
  deck,
  hardMode,
}: {
  sessionId: string;
  entries: Entry[];
  deck: Word[];
  hardMode: boolean;
}) {
  const router = useRouter();
  const planned = initialEntries.length;

  const [sessionId, setSessionId] = useState(initialSessionId);
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
  }, []);
  const demotionsRef = useRef(0);
  const requeued = useRef<Set<string>>(new Set());

  const entry = queue[pos];

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

      const sentenceIndex = entry.question.sentenceIndex;
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

      // Background write (SPEC 5.5) — retry a couple of times, then give up quietly.
      void retry(() =>
        submitAnswer({
          review: {
            word_id: word.id,
            level: quizLevel(word.level),
            result,
            duration_ms: Math.min(durationMs, 120_000),
            help_used: helpUsed,
            source: entry.item.source,
          },
          card: { id: word.id, ...newState },
          sentenceShownIndex: sentenceIndex,
        }),
      );

      // Wrong words come back once at the end of the session (SPEC 2.7).
      if ((result === "wrong" || result === "dontknow") && !requeued.current.has(word.id)) {
        requeued.current.add(word.id);
        setQueue((q) => [...q, { item: entry.item, question: buildQuestion(word, quizLevel(word.level), deck) }]);
      }
    },
    [entry, hardMode, deck],
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
      void finishSession(sessionId, { answered: outcomes.length, completed: !quitEarly });
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
    void finishSession(sessionId, { answered: outcomes.length, completed: false });
  }

  async function practiceMore() {
    const seen = [...new Set(outcomes.map((o) => o.entry.item.word.id))];
    const items = buildPracticeSession(deck, planned, seen);
    if (items.length === 0) return;
    const fresh = items.map((item) => ({
      item,
      question: buildQuestion(item.word, quizLevel(item.word.level), deck),
    }));
    const id = await createSession(fresh.length, "practice");
    setSessionId(id);
    setQueue(fresh);
    setPos(0);
    setOutcomes([]);
    setLast(null);
    setQuitEarly(false);
    demotionsRef.current = 0;
    requeued.current = new Set();
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
      <div className="flex items-center gap-3">
        <button onClick={() => setShowQuit(true)} className="text-text-dim" aria-label="Quit session">
          ×
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${(answered / planned) * 100}%` }}
          />
        </div>
        <span className="text-sm tabular-nums text-text-faint">
          {Math.min(answered + 1, planned)}/{planned}
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
          <div className="w-full rounded-3xl border border-border bg-surface p-5">
            <p className="font-semibold">Quit session?</p>
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
  const budget = hintBudget(question.answer);

  function hint() {
    if (revealed.length >= budget) return;
    const p = nextHintPosition(question.answer, revealed);
    if (p >= 0) setRevealed((r) => [...r, p]);
  }

  return (
    <div className="slide-in flex flex-1 flex-col pt-10">
      {question.sentence ? (
        <p className="text-lg leading-relaxed">{question.sentence}</p>
      ) : (
        <p className="text-center text-3xl font-bold">{question.prompt}</p>
      )}
      {question.sentence && (
        <p className="mt-2 text-sm text-text-faint">{question.prompt}</p>
      )}

      {question.level === 4 ? (
        <form
          className="mt-auto space-y-3 safe-b"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim()) onTyped(typed, revealed.length);
          }}
        >
          <div className="text-center font-mono text-xl tracking-[0.3em]">
            {hintMask(question.answer, revealed)}
          </div>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
            className="w-full rounded-2xl border border-border bg-surface px-4 py-4 text-center text-xl outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="w-auto flex-1"
              onClick={hint}
              disabled={revealed.length >= budget}
            >
              Hint ({budget - revealed.length})
            </Button>
            <Button type="submit" className="w-auto flex-1" disabled={!typed.trim()}>
              Answer
            </Button>
          </div>
          <button type="button" onClick={onDontKnow} className="w-full py-2 text-text-faint">
            Don&rsquo;t know
          </button>
        </form>
      ) : (
        <div className="mt-auto space-y-3 safe-b">
          <div className="space-y-2">
            {question.options.map((opt) => (
              <button
                key={opt}
                onClick={() => onChoice(opt)}
                className="w-full rounded-2xl border border-border bg-surface px-4 py-4 text-left active:bg-surface-2"
              >
                {opt}
              </button>
            ))}
          </div>
          <button onClick={onDontKnow} className="w-full py-2 text-text-faint">
            Don&rsquo;t know
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Feedback */

function topLine(o: Outcome): { icon: string; text: string; className: string } {
  const secs = (o.durationMs / 1000).toFixed(1);
  switch (o.result) {
    case "correct":
      return { icon: "✅", text: `Correct · ${secs}s`, className: "text-good" };
    case "slow":
      return o.helpUsed > 0
        ? { icon: "🐢", text: `Correct, used ${o.helpUsed} hint${o.helpUsed > 1 ? "s" : ""}`, className: "text-slow" }
        : { icon: "🐢", text: `Correct, but slow · ${secs}s`, className: "text-slow" };
    case "wrong":
      return { icon: "❌", text: "Wrong", className: "text-bad" };
    case "dontknow":
      return { icon: "⬜", text: "Not yet — that's fine", className: "text-text-dim" };
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
  const [sentences, setSentences] = useState(word.sentences);
  const [regenerating, setRegenerating] = useState(false);
  const line = topLine(outcome);

  const shownIndex = outcome.entry.question.sentenceIndex ?? 0;
  const shownSentence = sentences[shownIndex] ? [sentences[shownIndex]] : sentences.slice(0, 1);

  const days = daysBetween(today(), outcome.newState.due_date);
  const dueLabel = days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;

  async function changeSentence() {
    setRegenerating(true);
    try {
      const fresh = await regenerateSentence(word.id, shownIndex);
      setSentences((s) => s.map((x, i) => (i === shownIndex ? fresh : x)));
    } catch {
      /* ignore */
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="slide-in flex flex-1 flex-col pt-6">
      <div className={`text-lg font-semibold ${line.className}`}>
        {line.icon} {line.text}
      </div>
      {outcome.result === "wrong" && outcome.typedAnswer && (
        <div className="text-sm text-text-dim">Your answer: {outcome.typedAnswer}</div>
      )}
      {outcome.almost && (
        <div className="text-sm text-slow">Almost — it&rsquo;s spelled {outcome.entry.question.answer}</div>
      )}

      <div className="my-5 h-px bg-border" />

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

      <div className="my-5 h-px bg-border" />

      <div className="flex items-center justify-between text-sm">
        <LevelIndicator oldLevel={outcome.oldLevel} newState={outcome.newState} />
        {!hardMode && <span className="text-text-dim">{dueLabel}</span>}
      </div>
      <button
        onClick={changeSentence}
        disabled={regenerating}
        className="mt-2 self-end text-sm text-accent disabled:opacity-40"
      >
        {regenerating ? "…" : "✎ change sentence"}
      </button>

      <div className="mt-auto safe-b">
        <Button onClick={onContinue}>Continue →</Button>
      </div>
    </div>
  );
}

function LevelIndicator({ oldLevel, newState }: { oldLevel: number; newState: CardState }) {
  const target = CONFIG.LEVEL_TARGETS[newState.level] ?? 3;
  const dots = Array.from({ length: target }, (_, i) => (i < newState.streak ? "●" : "○")).join("");
  return (
    <span className="text-text-dim">
      {newState.level >= 5 ? (
        <span className="text-good">✓ Finished</span>
      ) : (
        <>
          Level {newState.level} <span className="tracking-widest">{dots}</span>
          {newState.level !== oldLevel && (
            <span className={newState.level > oldLevel ? "text-good" : "text-slow"}>
              {" "}
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
        <div className="text-5xl">✓</div>
        <h1 className="mt-2 text-2xl font-bold">
          {quitEarly ? "Session stopped" : "Session complete"}
        </h1>
      </div>

      <div className="mt-6 flex justify-center gap-6 text-lg">
        <span>✅ {good}</span>
        <span>🐢 {slow}</span>
        <span>❌ {bad}</span>
      </div>

      {allCorrect && <p className="mt-3 text-center text-good">Nice, all correct 🎉</p>}

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="my-3 h-px bg-border" />
      <div className="text-sm uppercase tracking-wide text-text-faint">{title}</div>
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

/* ---------------------------------------------------------------- utils */

async function retry(fn: () => Promise<unknown>, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      await fn();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
}
