"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createRng } from "../../lib/rng";
import {
  answerChoices,
  arithmeticQuestion,
  dmasQuestion,
  type ArithmeticQuestion,
} from "../../lib/games/reflex";
import { cn, formatClock } from "../../lib/utils/cn";
import type { BoardProps } from "./types";

export type ArithmeticMode = "sprint" | "fastestfinger" | "dmas";

/**
 * Sprint, Fastest Finger and DMAS share one loop: a board at a time, for 60
 * seconds, scored by how many you clear. Sprint and DMAS take a typed answer;
 * Fastest Finger is multiple choice ("race to solve the most in 1 minute").
 */
export function ArithmeticDuel({
  mode,
  seed,
  level,
  durationMs,
  session,
  onSolved,
}: BoardProps & {
  mode: ArithmeticMode;
  seed: string;
  level: number;
  durationMs: number;
}) {
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [flash, setFlash] = useState<"none" | "right" | "wrong">("none");
  const finished = useRef(false);

  const question = useMemo<ArithmeticQuestion>(() => {
    const rng = createRng(`${seed}:${index}`);
    return mode === "dmas" ? dmasQuestion(rng, level) : arithmeticQuestion(rng, level);
  }, [seed, index, mode, level]);

  const choices = useMemo(
    () => (mode === "fastestfinger" ? answerChoices(createRng(`${seed}:choices:${index}`), question.answer) : null),
    [mode, seed, index, question.answer],
  );

  useEffect(() => {
    if (!session.running || finished.current) return;
    if (session.elapsedMs >= durationMs) {
      finished.current = true;
      session.finish();
      onSolved({ points: session.correct, answered: index });
    }
  }, [session, durationMs, index, onSolved]);

  function answer(value: number) {
    if (!session.running) return;
    if (value === question.answer) {
      session.addCorrect();
      setFlash("right");
      setIndex((current) => current + 1);
      setInput("");
    } else {
      session.addMistake();
      setFlash("wrong");
      setInput("");
    }
    window.setTimeout(() => setFlash("none"), 180);
  }

  const remaining = Math.max(0, durationMs - session.elapsedMs);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="tabular text-sm font-semibold text-lime-brand">{session.correct} correct</span>
        <span className="tabular text-sm font-semibold text-ink-200">{formatClock(remaining)}</span>
      </div>

      <div
        className={cn(
          "rounded-2xl border p-5 text-center transition",
          flash === "right" && "border-lime-brand bg-lime-brand/10",
          flash === "wrong" && "border-berry bg-berry/10",
          flash === "none" && "border-ink-700 bg-ink-900",
        )}
      >
        <p className="text-[11px] tracking-wide text-ink-400 uppercase">
          {mode === "dmas" ? `Board ${index + 1} · DMAS` : `Board ${index + 1}`}
        </p>
        <p className="tabular mt-2 text-3xl font-black text-ink-50">{question.prompt}</p>
      </div>

      {choices ? (
        <div className="grid grid-cols-2 gap-2">
          {choices.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => answer(choice)}
              className="tabular rounded-xl bg-ink-800 py-3 text-lg font-bold text-ink-50 transition hover:bg-ink-700 active:scale-95"
            >
              {choice}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="tabular rounded-xl border border-ink-700 bg-ink-950 px-4 py-3 text-center text-2xl font-bold text-ink-50">
            {input || <span className="text-ink-500">?</span>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }, (_, i) => i + 1).map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => setInput((current) => `${current}${digit}`.replace(/^0+/, ""))}
                className="tabular rounded-xl bg-ink-800 py-3 text-lg font-bold text-ink-50 hover:bg-ink-700 active:scale-95"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setInput("")}
              className="rounded-xl bg-ink-800 py-3 text-sm font-semibold text-ink-200 hover:bg-ink-700"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setInput("0")}
              className="tabular rounded-xl bg-ink-800 py-3 text-lg font-bold text-ink-50 hover:bg-ink-700"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => {
                if (input === "") return;
                answer(Number(input));
              }}
              className="rounded-xl bg-lime-brand py-3 text-sm font-bold text-lime-ink hover:bg-lime-soft"
            >
              Enter
            </button>
          </div>
        </>
      )}

      <p className="text-[11px] text-ink-400">
        {session.mistakes} wrong attempt{session.mistakes === 1 ? "" : "s"} so far. Wrong answers still cost
        accuracy even after you correct them.
      </p>
    </div>
  );
}
