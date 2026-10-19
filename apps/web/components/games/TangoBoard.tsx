"use client";

import { useMemo, useState } from "react";
import { validateTango, type TangoPuzzle, type TangoSymbol } from "../../lib/games/tango";
import { cn } from "../../lib/utils/cn";
import { Grid, Tile } from "./parts";
import type { BoardProps } from "./types";

export function TangoBoard({
  puzzle,
  session,
  onSolved,
}: BoardProps & { puzzle: TangoPuzzle }) {
  const [grid, setGrid] = useState<Array<TangoSymbol | null>>(() => [...puzzle.givens]);

  const validation = useMemo(() => validateTango(puzzle, grid), [puzzle, grid]);
  const conflictSet = useMemo(() => new Set(validation.conflicts), [validation.conflicts]);

  function cycle(cell: number) {
    if (!session.running || puzzle.givens[cell] !== null) return;
    const current = grid[cell];
    const next = current === null ? 0 : current === 0 ? 1 : null;
    const updated = [...grid];
    updated[cell] = next;
    setGrid(updated);

    if (next === null) {
      session.addMistake();
      return;
    }

    const checked = validateTango(puzzle, updated);
    if (checked.conflicts.includes(cell)) session.addMistake();
    else {
      session.addCorrect();
      if (checked.solved) onSolved({ symbols: updated.length });
    }
  }

  const markerFor = (cell: number) =>
    puzzle.constraints.filter((constraint) => constraint.a === cell || constraint.b === cell);

  return (
    <div className="space-y-3">
      <Grid size={puzzle.size} gap={4}>
        {grid.map((value, cell) => {
          const given = puzzle.givens[cell] !== null;
          const markers = markerFor(cell);
          const rightMarker = markers.find((m) => m.b === cell + 1 && m.kind);
          const downMarker = markers.find((m) => m.b === cell + puzzle.size && m.kind);
          return (
            <Tile
              key={cell}
              onClick={() => cycle(cell)}
              ariaLabel={`Row ${Math.floor(cell / puzzle.size) + 1} column ${(cell % puzzle.size) + 1}`}
              className={cn(
                "bg-ink-800 text-ink-50",
                given && "bg-ink-700",
                conflictSet.has(cell) && "ring-2 ring-berry",
              )}
            >
              {value === 0 ? (
                <span className="h-4 w-4 rounded-full bg-sky" />
              ) : value === 1 ? (
                <span className="h-4 w-4 rounded-[4px] bg-gold" />
              ) : null}
              {rightMarker ? (
                <span className="absolute top-1/2 -right-2.5 -translate-y-1/2 rounded bg-ink-950 px-0.5 text-[9px] font-black text-ink-200">
                  {rightMarker.kind}
                </span>
              ) : null}
              {downMarker ? (
                <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 rounded bg-ink-950 px-0.5 text-[9px] font-black text-ink-200">
                  {downMarker.kind}
                </span>
              ) : null}
            </Tile>
          );
        })}
      </Grid>
      <div className="flex items-center gap-4 text-[11px] text-ink-300">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-sky" /> circle
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] bg-gold" /> square
        </span>
        <span>= same · ≠ different</span>
      </div>
      <p className="text-[11px] text-ink-400">
        {validation.filled} of {puzzle.size * puzzle.size} cells filled. Three identical symbols may never
        sit consecutively.
      </p>
    </div>
  );
}
