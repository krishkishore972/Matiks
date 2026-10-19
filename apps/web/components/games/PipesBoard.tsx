"use client";

import { useMemo, useState } from "react";
import { openings, validatePipes, E, N, S, W, type PipesPuzzle } from "../../lib/games/pipes";
import { cn } from "../../lib/utils/cn";
import { Grid } from "./parts";
import type { BoardProps } from "./types";

/** Draws a tile's openings as strokes on a 40×40 canvas. */
function PipeGlyph({ mask, tone }: { mask: number; tone: string }) {
  const stroke = tone;
  const common = { stroke, strokeWidth: 5, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 40 40" className="h-full w-full">
      <circle cx="20" cy="20" r="4.5" fill={stroke} />
      {mask & N ? <line x1="20" y1="20" x2="20" y2="4" {...common} /> : null}
      {mask & E ? <line x1="20" y1="20" x2="36" y2="20" {...common} /> : null}
      {mask & S ? <line x1="20" y1="20" x2="20" y2="36" {...common} /> : null}
      {mask & W ? <line x1="20" y1="20" x2="4" y2="20" {...common} /> : null}
    </svg>
  );
}

export function PipesBoard({ puzzle, session, onSolved }: BoardProps & { puzzle: PipesPuzzle }) {
  const [cells, setCells] = useState(() => puzzle.cells.map((cell) => ({ ...cell })));

  const view = useMemo(() => ({ ...puzzle, cells }), [puzzle, cells]);
  const validation = useMemo(() => validatePipes(view), [view]);
  const leakSet = useMemo(() => new Set(validation.leaks), [validation.leaks]);

  function rotate(index: number) {
    if (!session.running) return;
    const next = cells.map((cell, i) => (i === index ? { ...cell, rotation: (cell.rotation + 1) % 4 } : cell));
    setCells(next);

    // Rotating a tile that was already correct is a real mistake.
    if (cells[index].rotation === cells[index].solution) session.addMistake();
    else session.addCorrect();

    const checked = validatePipes({ ...puzzle, cells: next });
    if (checked.solved) onSolved({ tiles: next.length });
  }

  return (
    <div className="space-y-3">
      <Grid size={puzzle.size} gap={3}>
        {cells.map((cell, index) => (
          <button
            key={index}
            type="button"
            onClick={() => rotate(index)}
            aria-label={`Rotate tile ${index + 1}`}
            className={cn(
              "relative flex aspect-square items-center justify-center rounded-[10px] bg-ink-800 p-1 transition active:scale-95",
              leakSet.has(index) && "bg-berry/20",
              cell.rotation === cell.solution && "bg-lime-brand/15",
            )}
          >
            <PipeGlyph mask={openings(cell)} tone={cell.rotation === cell.solution ? "#b1fa63" : "#9fd0ff"} />
          </button>
        ))}
      </Grid>
      <p className="text-[11px] text-ink-400">
        {validation.leaks.length} leaks · {validation.components} connected network
        {validation.components === 1 ? "" : "s"}. Tap a tile to rotate it a quarter turn.
      </p>
    </div>
  );
}
