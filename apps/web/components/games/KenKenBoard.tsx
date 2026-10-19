"use client";

import { useMemo, useState } from "react";
import {
  cageIndexByCell,
  validateKenKen,
  type KenKenPuzzle,
} from "../../lib/games/kenken";
import { cn } from "../../lib/utils/cn";
import { Grid } from "./parts";
import type { BoardProps } from "./types";

export function KenKenBoard({
  puzzle,
  session,
  onSolved,
}: BoardProps & { puzzle: KenKenPuzzle }) {
  const [grid, setGrid] = useState<number[]>(() => new Array(puzzle.size * puzzle.size).fill(0));
  const [selected, setSelected] = useState<number | null>(null);

  const cageOf = useMemo(() => cageIndexByCell(puzzle), [puzzle]);
  const validation = useMemo(() => validateKenKen(puzzle, grid), [puzzle, grid]);
  const size = puzzle.size;

  function place(digit: number) {
    if (selected === null || !session.running) return;
    const next = [...grid];
    next[selected] = next[selected] === digit ? 0 : digit;
    setGrid(next);

    if (next[selected] === 0) {
      session.addMistake();
      return;
    }

    const checked = validateKenKen(puzzle, next);
    const broke =
      checked.rowConflicts.includes(selected) ||
      checked.colConflicts.includes(selected) ||
      checked.cageViolations.includes(selected);
    if (broke) session.addMistake();
    else {
      session.addCorrect();
      if (checked.solved) onSolved({ cages: puzzle.cages.length });
    }
  }

  const sides = (index: number) => {
    const row = Math.floor(index / size);
    const col = index % size;
    const cage = cageOf[index];
    return {
      top: row === 0 || cageOf[index - size] !== cage,
      left: col === 0 || cageOf[index - 1] !== cage,
      right: col === size - 1 || cageOf[index + 1] !== cage,
      bottom: row === size - 1 || cageOf[index + size] !== cage,
    };
  };

  const clueFor = (cageIndex: number) => {
    const cage = puzzle.cages[cageIndex];
    const first = Math.min(...cage.cells);
    return { first, label: cage.op === "=" ? `${cage.target}` : `${cage.target}${cage.op}` };
  };

  return (
    <div className="space-y-3">
      <Grid size={size} gap={0}>
        {grid.map((value, index) => {
          const edge = sides(index);
          const cageIndex = cageOf[index];
          const clue = clueFor(cageIndex);
          const isDuplicate =
            validation.rowConflicts.includes(index) || validation.colConflicts.includes(index);
          const badCage = validation.cageViolations.includes(index);
          return (
            <button
              key={index}
              type="button"
              onClick={() => setSelected(index)}
              className={cn(
                "tabular relative flex aspect-square items-center justify-center text-base font-bold transition",
                "bg-ink-900 text-lime-brand",
                selected === index && "bg-ink-800 ring-2 ring-lime-brand",
                (isDuplicate || badCage) && "text-berry",
              )}
              style={{
                borderTop: edge.top ? "2px solid #4db8ff" : "1px solid rgba(255,255,255,0.08)",
                borderLeft: edge.left ? "2px solid #4db8ff" : "1px solid rgba(255,255,255,0.08)",
                borderRight: edge.right ? "2px solid #4db8ff" : "1px solid rgba(255,255,255,0.08)",
                borderBottom: edge.bottom ? "2px solid #4db8ff" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {index === clue.first ? (
                <span className="absolute top-0.5 left-1 text-[10px] font-bold text-sky">{clue.label}</span>
              ) : null}
              <span className={index === clue.first ? "mt-1.5" : ""}>{value !== 0 ? value : ""}</span>
            </button>
          );
        })}
      </Grid>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: size }, (_, i) => i + 1).map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => place(digit)}
            className="tabular min-w-10 flex-1 rounded-xl bg-ink-800 py-2.5 text-base font-bold text-ink-50 transition hover:bg-ink-700 active:scale-95"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            if (selected === null) return;
            const next = [...grid];
            next[selected] = 0;
            setGrid(next);
            session.addMistake();
          }}
          className="min-w-16 flex-1 rounded-xl bg-ink-800 py-2.5 text-xs font-semibold text-ink-200 hover:bg-ink-700"
        >
          Clear
        </button>
      </div>

      <p className="text-[11px] text-ink-400">
        {validation.filled} of {size * size} cells placed. Each number appears once per row and column,
        and every cage must hit its target.
      </p>
    </div>
  );
}
