"use client";

import { useMemo, useState } from "react";
import { validateCrossMath, type CrossMathPuzzle } from "../../lib/games/crossmath";
import { cn } from "../../lib/utils/cn";
import { Grid } from "./parts";
import type { BoardProps } from "./types";

export function CrossMathBoard({
  puzzle,
  session,
  onSolved,
}: BoardProps & { puzzle: CrossMathPuzzle }) {
  const [grid, setGrid] = useState<number[]>(() => [...puzzle.solution]);
  const [selected, setSelected] = useState<number | null>(puzzle.hidden[0] ?? null);

  const validation = useMemo(() => validateCrossMath(puzzle, grid), [puzzle, grid]);
  const hiddenSet = useMemo(() => new Set(puzzle.hidden), [puzzle.hidden]);

  // Hide the values the player has to supply.
  const display = grid.map((value, index) => (hiddenSet.has(index) ? 0 : value));

  function place(digit: number) {
    if (selected === null || !session.running) return;
    const next = [...grid];
    next[selected] = next[selected] === digit ? 0 : digit;
    setGrid(next);

    if (next[selected] === 0) {
      session.addMistake();
      return;
    }

    const checked = validateCrossMath(puzzle, next);
    if (checked.wrong.includes(selected)) session.addMistake();
    else {
      session.addCorrect();
      if (checked.solved) onSolved({ equations: puzzle.equations.length });
    }
  }

  return (
    <div className="space-y-3">
      <Grid size={puzzle.size} gap={4}>
        {puzzle.kinds.map((kind, index) => {
          if (kind === "void") return <span key={index} aria-hidden />;
          if (kind === "op") {
            return (
              <span
                key={index}
                className="tabular flex aspect-square items-center justify-center text-lg font-bold text-gold"
              >
                {puzzle.ops[index] === "*" ? "×" : puzzle.ops[index] === "/" ? "÷" : puzzle.ops[index]}
              </span>
            );
          }
          const isHidden = hiddenSet.has(index);
          return (
            <button
              key={index}
              type="button"
              onClick={() => (isHidden ? setSelected(index) : undefined)}
              className={cn(
                "tabular flex aspect-square items-center justify-center rounded-lg text-base font-bold transition",
                isHidden
                  ? "bg-ink-800 text-lime-brand"
                  : "border border-ink-700/60 bg-ink-950 text-ink-100",
                isHidden && selected === index && "ring-2 ring-lime-brand",
                validation.wrong.includes(index) && "text-berry",
              )}
            >
              {display[index] !== 0 ? display[index] : ""}
            </button>
          );
        })}
      </Grid>

      <div className="space-y-1 rounded-xl bg-ink-900/60 p-2.5">
        <p className="text-[11px] font-semibold tracking-wide text-ink-300 uppercase">
          Targets (left to right, no BODMAS)
        </p>
        <div className="flex flex-wrap gap-3">
          {puzzle.equations.map((equation, index) => (
            <span key={index} className="tabular text-xs text-ink-200">
              {equation.orientation === "row" ? `R${Math.floor(equation.cells[0] / puzzle.size) + 1}` : `C${(equation.cells[0] % puzzle.size) + 1}`} = {equation.target}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 9 }, (_, i) => i + 1).map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => place(digit)}
            className="tabular min-w-10 flex-1 rounded-xl bg-ink-800 py-2.5 text-base font-bold text-ink-50 hover:bg-ink-700 active:scale-95"
          >
            {digit}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-ink-400">
        {validation.filled} of {validation.total} blanks filled.
      </p>
    </div>
  );
}
