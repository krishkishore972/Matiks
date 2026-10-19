"use client";

import { useEffect, useMemo, useState } from "react";
import { createRng } from "../../lib/rng";
import { flashAnzanRound } from "../../lib/games/reflex";
import { cn } from "../../lib/utils/cn";
import type { BoardProps } from "./types";

const ROUNDS = 3;
const POINTS_PER_TERM = 10;

/**
 * Flash Anzan: "3 rounds of fast mental addition". Numbers appear one after
 * another and vanish; the player recalls the total. A round is worth
 * `terms × 10` points (inferred — the shipped game's exact point table is not in
 * the extracted strings, only the minimum score of 90).
 */
export function FlashAnzanDuel({
  seed,
  session,
  onSolved,
}: BoardProps & { seed: string }) {
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<"flash" | "input">("flash");
  const [cursor, setCursor] = useState(0);
  const [input, setInput] = useState("");
  const [points, setPoints] = useState(0);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const data = useMemo(
    () => flashAnzanRound(createRng(`${seed}:round:${round}`), { count: 5, digits: 2, intervalMs: 750, subtract: true }),
    [seed, round],
  );

  useEffect(() => {
    if (!session.running || phase !== "flash") return;
    if (cursor >= data.numbers.length) {
      const id = window.setTimeout(() => setPhase("input"), 250);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setCursor((current) => current + 1), data.intervalMs);
    return () => window.clearTimeout(id);
  }, [phase, cursor, data, session.running]);

  function submit() {
    const value = Number(input);
    const correct = value === data.answer;
    if (correct) {
      session.addCorrect();
      setPoints((current) => current + data.numbers.length * POINTS_PER_TERM);
      setLastResult(`Correct — ${data.numbers.join(" ")} = ${data.answer}`);
    } else {
      session.addMistake();
      setLastResult(`Not quite — the total was ${data.answer}`);
    }
    setInput("");

    if (round + 1 >= ROUNDS) {
      session.finish();
      onSolved({
        points: correct ? points + data.numbers.length * POINTS_PER_TERM : points,
        rounds: ROUNDS,
      });
      return;
    }
    setRound((current) => current + 1);
    setCursor(0);
    setPhase("flash");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="tabular text-sm font-semibold text-lime-brand">{points} pts</span>
        <span className="text-xs text-ink-400">Round {Math.min(round + 1, ROUNDS)} of {ROUNDS}</span>
      </div>

      <div className="grid h-40 place-items-center rounded-2xl border border-ink-700 bg-ink-900">
        {phase === "flash" ? (
          <span
            key={cursor}
            className="animate-pop tabular text-5xl font-black text-ink-50"
          >
            {cursor < data.numbers.length ? data.numbers[cursor] : ""}
          </span>
        ) : (
          <span className={cn("tabular text-4xl font-black", input ? "text-ink-50" : "text-ink-600")}>
            {input || "?"}
          </span>
        )}
      </div>

      {phase === "input" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }, (_, i) => i + 1).map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => setInput((current) => `${current}${digit}`)}
                className="tabular rounded-xl bg-ink-800 py-3 text-lg font-bold text-ink-50 hover:bg-ink-700 active:scale-95"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setInput((current) => `${current}-`)}
              className="rounded-xl bg-ink-800 py-3 text-lg font-bold text-gold hover:bg-ink-700"
            >
              −
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
              onClick={submit}
              className="rounded-xl bg-lime-brand py-3 text-sm font-bold text-lime-ink hover:bg-lime-soft"
            >
              Enter
            </button>
          </div>
          <button
            type="button"
            onClick={() => setInput("")}
            className="w-full rounded-xl bg-ink-800 py-2 text-xs font-semibold text-ink-200 hover:bg-ink-700"
          >
            Clear
          </button>
        </div>
      ) : (
        <p className="text-center text-[11px] text-ink-400">Keep the running total in your head.</p>
      )}

      {lastResult ? (
        <p className="rounded-xl bg-ink-900/70 px-3 py-2 text-xs text-ink-200">{lastResult}</p>
      ) : null}
    </div>
  );
}
