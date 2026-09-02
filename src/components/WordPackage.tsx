"use client";

import { useState } from "react";
import { Speak } from "./Speak";
import type { Meaning, Sentence } from "@/lib/types";

export interface WordPackageProps {
  word: string;
  phonetic: string | null;
  audioUrl: string | null;
  pos: string;
  definition: string;
  origin: string | null;
  otherMeanings: Meaning[];
  /** Sentences to show. Feedback passes the one shown; detail passes all. */
  sentences: Sentence[];
  /** Show every sentence with a "(+N more)" affordance (Word detail). */
  expandableSentences?: boolean;
}

export function WordPackage(props: WordPackageProps) {
  const [showMeanings, setShowMeanings] = useState(false);
  const [showOrigin, setShowOrigin] = useState(false);
  const [showAllSentences, setShowAllSentences] = useState(false);

  const visibleSentences = props.expandableSentences && !showAllSentences
    ? props.sentences.slice(0, 2)
    : props.sentences;
  const hiddenCount = props.sentences.length - visibleSentences.length;

  return (
    <div className="space-y-3">
      <div>
        <div className="font-serif text-[27px] font-medium tracking-[-0.01em]">{props.word}</div>
        {props.phonetic ? (
          <div className="flex items-center gap-1 text-text-dim">
            <span className="text-sm">{props.phonetic}</span>
            <Speak word={props.word} audioUrl={props.audioUrl} />
          </div>
        ) : (
          <Speak word={props.word} audioUrl={props.audioUrl} />
        )}
      </div>

      <div>
        <div className="font-serif text-[15px] italic text-text-faint">{props.pos}</div>
        <div className="text-text">{props.definition}</div>
      </div>

      {props.sentences.length > 0 && (
        <ul className="space-y-2 border-l-2 border-[var(--accent-line)] pl-3.5 font-serif text-[15.5px] italic leading-relaxed text-text-dim">
          {visibleSentences.map((s, i) => (
            <li key={i}>{s.text}</li>
          ))}
          {props.expandableSentences && hiddenCount > 0 && (
            <li className="not-italic">
              <button className="text-accent" onClick={() => setShowAllSentences(true)}>
                (+{hiddenCount} more)
              </button>
            </li>
          )}
        </ul>
      )}

      {props.otherMeanings.length > 0 && (
        <div>
          <button
            className="text-sm text-accent"
            onClick={() => setShowMeanings((v) => !v)}
          >
            {showMeanings ? "▾" : "▸"} {props.otherMeanings.length} more meaning
            {props.otherMeanings.length > 1 ? "s" : ""}
          </button>
          {showMeanings && (
            <ul className="mt-2 space-y-1 text-sm text-text-dim">
              {props.otherMeanings.map((m, i) => (
                <li key={i}>
                  <span className="text-text-faint">{m.pos}</span> {m.definition}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {props.origin && (
        <div>
          <button className="text-sm text-accent" onClick={() => setShowOrigin((v) => !v)}>
            {showOrigin ? "▾" : "▸"} Origin
          </button>
          {showOrigin && <p className="mt-1 text-sm text-text-dim">{props.origin}</p>}
        </div>
      )}
    </div>
  );
}
