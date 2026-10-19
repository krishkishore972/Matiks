"use client";

import { useMemo, useState } from "react";
import { validateMathMaze, type MathMazePuzzle } from "../../lib/games/mathmaze";
import { cn } from "../../lib/utils/cn";
import { Grid } from "./parts";
import type { BoardProps } from "./types";

export function MathMazeBoard({
  puzzle,
  session,
  onSolved,
}: BoardProps & { puzzle: MathMazePuzzle }) {
  const [selection, setSelection] = useState<number[]>(() => new Array(puzzle.size).fill(-1));

  const validation = useMemo(() => validateMathMaze(puzzle, selection), [puzzle, selection]);

  function pick(row: number, col: number) {
    if (!session.running) return;
    const next = [...selection];
    next[row] = next[row] === col ? -1 : col;
    for (let r = row + 1; r < puzzle.size; r++) next[r] = -1;
    setSelection(next);

    const checked = validateMathMaze(puzzle, next);
    const illegal = checked.illegalSteps.length > 0;
    if (illegal) {
      session.addMistake();
      return;
    }
    if (next[row] !== -1) session.addCorrect();

    if (checked.filled === puzzle.size) {
      if (checked.solved) onSolved({ target: puzzle.target });
      else session.addMistake();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl bg-ink-900/70 px-3 py-2">
        <span className="text-xs text-ink-300">Running total</span>
        <span className="tabular text-lg font-black text-lime-brand">
          {validation.sum}
          <span className="text-ink-400"> / {puzzle.target}</span>
        </span>
      </div>

      <Grid size={puzzle.size} gap={4}>
        {puzzle.cells.map((value, index) => {
          const row = Math.floor(index / puzzle.size);
          const col = index % puzzle.size;
          const chosen = selection[row] === col;
          const isEntry = row === 0 && col === puzzle.entryCol;
          const isExit = row === puzzle.size - 1 && col === puzzle.exitCol;
          const illegal = validation.illegalSteps.includes(row) && chosen;
          return (
            <button
              key={index}
              type="button"
              onClick={() => pick(row, col)}
              className={cn(
                "tabular relative flex aspect-square items-center justify-center rounded-lg text-lg font-bold transition active:scale-95",
                chosen ? "bg-lime-brand text-lime-ink" : "bg-ink-800 text-ink-100",
                illegal && "bg-berry text-white",
                (isEntry || isExit) && !chosen && "ring-1 ring-gold",
              )}
            >
              {value}
              {isEntry ? (
                <span className="absolute -top-1 -left-1 rounded bg-gold px-1 text-[8px] font-black text-ink-950">
                  IN
                </span>
              ) : null}
              {isExit ? (
                <span className="absolute -top-1 -right-1 rounded bg-gold px-1 text-[8px] font-black text-ink-950">
                  OUT
                </span>
              ) : null}
            </button>
          );
        })}
      </Grid>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSelection(new Array(puzzle.size).fill(-1))}
          className="flex-1 rounded-xl bg-ink-800 py-2 text-xs font-semibold text-ink-200 hover:bg-ink-700"
        >
          Clear path
        </button>
      </div>
      <p className="text-[11px] text-ink-400">
        Pick one cell per row. You may move at most one column sideways between rows, start on IN and
        finish on OUT.
      </p>
    </div>
  );
}
