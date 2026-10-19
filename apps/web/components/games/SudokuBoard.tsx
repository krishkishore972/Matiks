"use client";

import { useMemo, useState } from "react";
import {
  SUDOKU_SIZE,
  validateSudoku,
  type SudokuGrid,
  type SudokuPuzzle,
} from "../../lib/games/sudoku";
import { cn } from "../../lib/utils/cn";
import { Grid } from "./parts";
import type { BoardProps } from "./types";

export function SudokuBoard({
  puzzle,
  session,
  onSolved,
}: BoardProps & { puzzle: SudokuPuzzle }) {
  const [grid, setGrid] = useState<SudokuGrid>(() => [...puzzle.givens]);
  const [selected, setSelected] = useState<number | null>(null);
  const [wrong, setWrong] = useState<Set<number>>(new Set());

  const validation = useMemo(() => validateSudoku(grid, puzzle.solution), [grid, puzzle.solution]);
  const givens = puzzle.givens;

  function place(digit: number) {
    if (selected === null || !session.running) return;
    if (givens[selected] !== 0) return;
    const next = [...grid];
    next[selected] = next[selected] === digit ? 0 : digit;
    setGrid(next);

    if (next[selected] === 0) {
      session.addMistake();
      return;
    }

    const checked = validateSudoku(next, puzzle.solution);
    if (checked.mistakes.includes(selected)) {
      session.addMistake();
      setWrong((current) => new Set(current).add(selected));
    } else {
      session.addCorrect();
      setWrong((current) => {
        const copy = new Set(current);
        copy.delete(selected);
        return copy;
      });
      if (checked.solved) onSolved({ blanks: puzzle.blanks });
    }
  }

  return (
    <div className="space-y-3">
      <Grid size={SUDOKU_SIZE} gap={2}>
        {grid.map((value, index) => {
          const row = Math.floor(index / SUDOKU_SIZE);
          const col = index % SUDOKU_SIZE;
          const isGiven = givens[index] !== 0;
          const isSelected = selected === index;
          const conflict = validation.conflicts.includes(index);
          return (
            <button
              key={index}
              type="button"
              aria-label={`Row ${row + 1} column ${col + 1}${value ? `, ${value}` : ", empty"}`}
              onClick={() => setSelected(index)}
              className={cn(
                "tabular flex aspect-square items-center justify-center rounded-md text-sm font-bold transition sm:text-base",
                isGiven ? "bg-ink-800 text-ink-100" : "bg-ink-900 text-lime-brand",
                isSelected && "ring-2 ring-lime-brand",
                (conflict || wrong.has(index)) && "text-berry",
                (row + 1) % 3 === 0 && row !== SUDOKU_SIZE - 1 ? "mb-0.5" : "",
                (col + 1) % 3 === 0 && col !== SUDOKU_SIZE - 1 ? "mr-0.5" : "",
              )}
            >
              {value !== 0 ? value : ""}
            </button>
          );
        })}
      </Grid>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 9 }, (_, i) => i + 1).map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => place(digit)}
            className="tabular min-w-10 flex-1 rounded-xl bg-ink-800 py-2.5 text-base font-bold text-ink-50 transition hover:bg-ink-700 active:scale-95"
          >
            {digit}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          if (selected === null) return;
          const next = [...grid];
          next[selected] = 0;
          setGrid(next);
          session.addMistake();
        }}
        className="w-full rounded-xl bg-ink-800 py-2 text-xs font-semibold text-ink-200 hover:bg-ink-700"
      >
        Clear selected cell (counts as a mistake)
      </button>

      <p className="text-[11px] text-ink-400">
        {validation.remaining} cells left · {validation.mistakes.length} currently wrong. Backspace and
        clears count towards accuracy, exactly as the reference app defines it.
      </p>
    </div>
  );
}
