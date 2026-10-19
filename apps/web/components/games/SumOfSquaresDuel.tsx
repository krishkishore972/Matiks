"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createRng } from "../../lib/rng";
import { sumOfSquares, validateSumOfSquares } from "../../lib/games/reflex";
import { cn, formatClock } from "../../lib/utils/cn";
import type { BoardProps } from "./types";

/** Ability duels: squares that add up to the target. Multiple solutions accepted. */
export function SumOfSquaresDuel({
  seed,
  durationMs,
  session,
  onSolved,
}: BoardProps & { seed: string; durationMs: number }) {
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<number[]>([]);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const finished = useRef(false);

  const puzzle = useMemo(() => sumOfSquares(createRng(`${seed}:${index}`), 3, 12), [seed, index]);

  useEffect(() => {
    if (!session.running || finished.current) return;
    if (session.elapsedMs >= durationMs) {
      finished.current = true;
      session.finish();
      onSolved({ points: session.correct, answered: index });
    }
  }, [session, durationMs, index, onSolved]);

  function submit() {
    if (!session.running) return;
    const attempt = values.length > 0 ? values : input.split(/\s+/).filter(Boolean).map(Number);
    const verdict = validateSumOfSquares(puzzle, attempt);
    if (verdict.ok) {
      session.addCorrect();
      setIndex((current) => current + 1);
      setValues([]);
      setInput("");
      setMessage(null);
      return;
    }
    session.addMistake();
    setMessage(verdict.over ? "Too high — that overshoots the target." : "Not the target yet.");
  }

  function addNumber() {
    const parsed = Number(input);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setValues((current) => [...current, parsed]);
    setInput("");
  }

  const sum = values.reduce((acc, value) => acc + value * value, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="tabular text-sm font-semibold text-lime-brand">{session.correct} solved</span>
        <span className="tabular text-sm font-semibold text-ink-200">
          {formatClock(Math.max(0, durationMs - session.elapsedMs))}
        </span>
      </div>

      <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5 text-center">
        <p className="text-[11px] tracking-wide text-ink-400 uppercase">Target · squares must add up to it</p>
        <p className="tabular mt-2 text-4xl font-black text-gold">{puzzle.target}</p>
        <p className="mt-1 text-[11px] text-ink-400">Use exactly {puzzle.terms} numbers.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {values.map((value, position) => (
          <span key={`${value}-${position}`} className="tabular rounded-full bg-ink-800 px-3 py-1.5 text-sm font-bold text-ink-50">
            {value}
            <span className="ml-1 text-[10px] text-ink-400">²</span>
          </span>
        ))}
        {values.length === 0 ? <span className="text-xs text-ink-400">No numbers added yet.</span> : null}
      </div>

      <div className="tabular rounded-xl border border-ink-700 bg-ink-950 px-4 py-3 text-center text-lg">
        <span className={cn(sum === puzzle.target ? "text-lime-brand" : sum > puzzle.target ? "text-berry" : "text-ink-200")}>
          {sum}
        </span>
        <span className="text-ink-500"> / {puzzle.target}</span>
      </div>

      {message ? (
        <p className="rounded-xl bg-berry/15 px-3 py-2 text-xs font-semibold text-berry">{message}</p>
      ) : null}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
          placeholder="Number"
          className="tabular flex-1 rounded-xl border border-ink-700 bg-ink-950 px-3 py-3 text-base text-ink-50 outline-none focus:border-lime-brand"
        />
        <button
          type="button"
          onClick={addNumber}
          className="rounded-xl bg-ink-800 px-4 text-sm font-semibold text-ink-100 hover:bg-ink-700"
        >
          Add
        </button>
        <button
          type="button"
          onClick={submit}
          className="rounded-xl bg-lime-brand px-4 text-sm font-bold text-lime-ink hover:bg-lime-soft"
        >
          Submit
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          setValues([]);
          setInput("");
          session.addMistake();
        }}
        className="w-full rounded-xl bg-ink-800 py-2 text-xs font-semibold text-ink-200 hover:bg-ink-700"
      >
        Clear (counts as a mistake)
      </button>
    </div>
  );
}
