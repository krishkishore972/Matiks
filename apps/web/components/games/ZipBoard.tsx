"use client";

import { useState } from "react";
import { validateZip, type ZipPuzzle } from "../../lib/games/zip";
import { cn } from "../../lib/utils/cn";
import { Grid, Tile } from "./parts";
import type { BoardProps } from "./types";

function neighbours(size: number, cell: number): number[] {
  const row = Math.floor(cell / size);
  const col = cell % size;
  const out: number[] = [];
  if (row > 0) out.push(cell - size);
  if (row < size - 1) out.push(cell + size);
  if (col > 0) out.push(cell - 1);
  if (col < size - 1) out.push(cell + 1);
  return out;
}

export function ZipBoard({ puzzle, session, onSolved }: BoardProps & { puzzle: ZipPuzzle }) {
  const [path, setPath] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const checkpointCount = puzzle.checkpoints.filter((value) => value > 0).length;

  function tap(cell: number) {
    if (!session.running) return;
    setMessage(null);

    // Backtracking by tapping the previous cell.
    if (path.length >= 2 && cell === path[path.length - 2]) {
      setPath(path.slice(0, -1));
      session.addMistake();
      return;
    }
    if (path.includes(cell)) return;

    if (path.length === 0) {
      if (cell !== puzzle.start) {
        setMessage("Start on checkpoint 1.");
        session.addMistake();
        return;
      }
      setPath([cell]);
      return;
    }

    const last = path[path.length - 1];
    if (!neighbours(puzzle.size, last).includes(cell)) {
      setMessage("The line must stay on adjacent cells.");
      session.addMistake();
      return;
    }

    const checkpoint = puzzle.checkpoints[cell];
    if (checkpoint > 0) {
      const passed = path.filter((value) => puzzle.checkpoints[value] > 0).length;
      if (checkpoint !== passed + 1) {
        setMessage(`Checkpoint ${checkpoint} is out of order — you need ${passed + 1} next.`);
        session.addMistake();
        return;
      }
    }

    const next = [...path, cell];
    setPath(next);
    session.addCorrect();

    const checked = validateZip(puzzle, next);
    if (next.length === puzzle.size * puzzle.size) {
      if (checked.solved) onSolved({ cells: next.length, checkpoints: checkpointCount });
      else if (checked.reason === "wrong-order") setMessage("Every cell is covered but a checkpoint is out of order.");
      else setMessage("Every cell is covered — but the line didn't reach the final checkpoint.");
    }
  }

  return (
    <div className="space-y-3">
      <Grid size={puzzle.size} gap={4}>
        {puzzle.checkpoints.map((checkpoint, cell) => {
          const step = path.indexOf(cell);
          const active = step >= 0;
          return (
            <Tile
              key={cell}
              onClick={() => tap(cell)}
              ariaLabel={`Cell ${cell}`}
              className={cn(
                "bg-ink-800 text-ink-200",
                active && "bg-lime-brand/25 text-ink-50",
                active && step === path.length - 1 && "bg-lime-brand text-lime-ink",
                checkpoint > 0 && !active && "bg-ink-700 text-gold",
              )}
            >
              {checkpoint > 0 ? <span className="text-sm font-black">{checkpoint}</span> : null}
            </Tile>
          );
        })}
      </Grid>

      {message ? (
        <p className="rounded-xl bg-berry/15 px-3 py-2 text-xs font-semibold text-berry">{message}</p>
      ) : (
        <p className="text-[11px] text-ink-400">
          {path.length} of {puzzle.size * puzzle.size} cells drawn. Tap the previous cell to backtrack.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (path.length === 0) return;
            setPath([]);
            setMessage(null);
            session.addMistake();
          }}
          className="flex-1 rounded-xl bg-ink-800 py-2.5 text-xs font-semibold text-ink-200 hover:bg-ink-700"
        >
          Clear line (mistake)
        </button>
        <button
          type="button"
          onClick={() => {
            if (path.length === 0) return;
            setPath(path.slice(0, -1));
            session.addMistake();
          }}
          className="flex-1 rounded-xl bg-ink-800 py-2.5 text-xs font-semibold text-ink-200 hover:bg-ink-700"
        >
          Step back
        </button>
      </div>
    </div>
  );
}
