"use client";

import { useEffect, useMemo, useState } from "react";
import { createRng } from "../../lib/rng";
import { pinBallBoard, pinBallScore } from "../../lib/games/reflex";
import { cn } from "../../lib/utils/cn";
import type { BoardProps } from "./types";

const BOARDS = 8;
const MEMORISE_MS = 5000;

/**
 * Pin Ball Recall. "Track the ball through the bumpers, then recall its exit.
 * The bumpers auto-hide after 5 seconds. An exact exit is 1 point, an adjacent
 * tap 0.5."
 */
export function PinBallDuel({ seed, session, onSolved }: BoardProps & { seed: string }) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"watch" | "guess" | "reveal">("watch");
  const [points, setPoints] = useState(0);
  const [guess, setGuess] = useState<number | null>(null);

  const board = useMemo(() => pinBallBoard(createRng(`${seed}:${index}`), 5, 5, 6), [seed, index]);

  useEffect(() => {
    if (!session.running || phase !== "watch") return;
    const id = window.setTimeout(() => setPhase("guess"), MEMORISE_MS);
    return () => window.clearTimeout(id);
  }, [phase, session.running, index]);

  function choose(column: number) {
    if (!session.running || phase !== "guess") return;
    const scored = pinBallScore(column, board.exitColumn);
    setGuess(column);
    setPoints((current) => current + scored);
    if (scored === 1) session.addCorrect();
    else session.addMistake();
    setPhase("reveal");

    window.setTimeout(() => {
      if (index + 1 >= BOARDS) {
        session.finish();
        onSolved({ points: points + scored, boards: BOARDS });
        return;
      }
      setIndex((current) => current + 1);
      setGuess(null);
      setPhase("watch");
    }, 900);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="tabular text-sm font-semibold text-lime-brand">{points} pts</span>
        <span className="text-xs text-ink-400">Board {index + 1} of {BOARDS}</span>
      </div>

      <div className="relative rounded-2xl border border-ink-700 bg-ink-900 p-3">
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${board.width}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: board.width * board.height }, (_, cell) => {
            const row = Math.floor(cell / board.width);
            const col = cell % board.width;
            const isBumper = phase !== "guess" && board.bumpers.includes(cell);
            const isBall = phase !== "guess" && board.columns[row] === col;
            return (
              <span
                key={cell}
                className={cn(
                  "grid aspect-square place-items-center rounded-lg bg-ink-800/70 text-xs font-bold",
                  isBumper && "bg-violet/40 text-violet",
                  isBall && "bg-lime-brand text-lime-ink",
                )}
              >
                {isBall ? "●" : isBumper ? "▲" : ""}
              </span>
            );
          })}
        </div>
        {phase === "guess" ? (
          <p className="absolute inset-x-3 bottom-3 rounded-lg bg-ink-950/90 px-3 py-1.5 text-center text-[11px] font-semibold text-ink-200">
            Bumpers hidden — which column did the ball exit?
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        {Array.from({ length: board.width }, (_, column) => (
          <button
            key={column}
            type="button"
            disabled={phase !== "guess"}
            onClick={() => choose(column)}
            className={cn(
              "tabular flex-1 rounded-xl py-3 text-sm font-bold transition",
              phase === "reveal" && guess === column && "bg-lime-brand text-lime-ink",
              phase === "reveal" && board.exitColumn === column && guess !== column && "bg-sky/30 text-sky",
              (phase === "guess" || guess !== column) && phase !== "reveal" && "bg-ink-800 text-ink-100 hover:bg-ink-700",
              phase === "reveal" && guess !== column && board.exitColumn !== column && "bg-ink-800 text-ink-400",
            )}
          >
            {column + 1}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-ink-400">
        {phase === "watch" ? "Watch the ball. The board hides after 5 seconds." : "Exact exit = 1 point, adjacent = 0.5."}
      </p>
    </div>
  );
}
