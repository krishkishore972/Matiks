"use client";

import { useMemo, useState } from "react";
import { validateQueens, type QueensPuzzle } from "../../lib/games/queens";
import { cn } from "../../lib/utils/cn";
import { Grid, Tile } from "./parts";
import { Icon } from "../icons";
import type { BoardProps } from "./types";

/** `QUEENS_COLORS` seen in the bundle; sampled to the app palette. */
const REGION_COLORS = ["#b1fa63", "#4db8ff", "#ffc53d", "#9d7bff", "#ff7a45", "#24fffb", "#ff4d6d", "#8fd44a"];

export function QueensBoard({
  puzzle,
  session,
  onSolved,
}: BoardProps & { puzzle: QueensPuzzle }) {
  const [queens, setQueens] = useState<number[]>([]);

  const validation = useMemo(() => validateQueens(puzzle, queens), [puzzle, queens]);
  const conflictSet = useMemo(() => new Set(validation.conflicts), [validation.conflicts]);

  function toggle(cell: number) {
    if (!session.running) return;
    const exists = queens.includes(cell);
    const next = exists ? queens.filter((value) => value !== cell) : [...queens, cell];
    if (exists) {
      session.addMistake();
      setQueens(next);
      return;
    }

    const checked = validateQueens(puzzle, next);
    setQueens(next);
    if (checked.conflicts.includes(cell)) session.addMistake();
    else {
      session.addCorrect();
      if (checked.solved) onSolved({ queens: next.length });
    }
  }

  return (
    <div className="space-y-3">
      <Grid size={puzzle.size} gap={3}>
        {puzzle.regions.map((region, cell) => (
          <Tile
            key={cell}
            onClick={() => toggle(cell)}
            ariaLabel={`Region ${region + 1}`}
            style={{ backgroundColor: `${REGION_COLORS[region % REGION_COLORS.length]}2e` }}
            className={cn(
              "text-ink-50",
              conflictSet.has(cell) && "ring-2 ring-berry",
              queens.includes(cell) && "ring-2 ring-ink-50/70",
            )}
          >
            {queens.includes(cell) ? <Icon name="Crown" className="h-5 w-5" /> : null}
          </Tile>
        ))}
      </Grid>
      <p className="text-[11px] text-ink-400">
        {queens.length} of {puzzle.size} queens placed. One per row, column and colour — and no queen may
        touch another, diagonals included.
      </p>
    </div>
  );
}
