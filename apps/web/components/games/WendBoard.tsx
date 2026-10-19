"use client";

import { useMemo, useState } from "react";
import { lettersAlong, validateWend, wendLengthHint, type WendPuzzle } from "../../lib/games/wend";
import { cn } from "../../lib/utils/cn";
import { Grid, Tile } from "./parts";
import type { BoardProps } from "./types";

export function WendBoard({ puzzle, session, onSolved }: BoardProps & { puzzle: WendPuzzle }) {
  const [path, setPath] = useState<number[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const validation = useMemo(() => validateWend(puzzle, []), [puzzle]); // shape only, for lengths
  const lengths = useMemo(() => wendLengthHint(puzzle), [puzzle]);
  void validation;

  const trace = lettersAlong(puzzle, path);

  function tap(cell: number) {
    if (!session.running) return;
    setMessage(null);
    if (path.length >= 2 && cell === path[path.length - 2]) {
      setPath(path.slice(0, -1));
      return;
    }
    if (path.includes(cell)) return;

    if (path.length > 0) {
      const last = path[path.length - 1];
      const adjacent = Math.abs(Math.floor(last / puzzle.size) - Math.floor(cell / puzzle.size)) +
        Math.abs((last % puzzle.size) - (cell % puzzle.size));
      if (adjacent !== 1) {
        setMessage("Letters must touch, side to side.");
        session.addMistake();
        return;
      }
    }

    const next = [...path, cell];
    setPath(next);
    const word = lettersAlong(puzzle, next);
    const target = puzzle.words.find((entry) => entry.word === word);
    if (target && !found.includes(word)) {
      const nextFound = [...found, word];
      setFound(nextFound);
      setPath([]);
      session.addCorrect();
      if (nextFound.length === puzzle.words.length) onSolved({ words: nextFound.length });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {lengths.map((length, index) => {
          const solved = found[index]?.length === length;
          return (
            <span
              key={`${length}-${index}`}
              className={cn(
                "tabular rounded-full px-2.5 py-1 text-xs font-semibold",
                solved ? "bg-lime-brand/20 text-lime-brand" : "bg-ink-800 text-ink-300",
              )}
            >
              {length} letters
            </span>
          );
        })}
      </div>

      <Grid size={puzzle.size} gap={3}>
        {puzzle.letters.map((letter, cell) => {
          const step = path.indexOf(cell);
          return (
            <Tile
              key={cell}
              onClick={() => tap(cell)}
              ariaLabel={`Letter ${letter}`}
              className={cn(
                "bg-ink-800 text-ink-50",
                step >= 0 && "bg-lime-brand/25",
                step === path.length - 1 && "bg-lime-brand text-lime-ink",
              )}
            >
              {letter}
            </Tile>
          );
        })}
      </Grid>

      <div className="rounded-xl bg-ink-900/70 px-3 py-2">
        <p className="text-[11px] text-ink-300">
          Tracing: <span className="tabular font-bold text-ink-50">{trace || "—"}</span>
        </p>
      </div>

      {message ? (
        <p className="rounded-xl bg-berry/15 px-3 py-2 text-xs font-semibold text-berry">{message}</p>
      ) : (
        <p className="text-[11px] text-ink-400">
          {found.length} of {puzzle.words.length} words found. Drag or tap adjacent letters; tap the
          previous letter to backtrack.
        </p>
      )}
    </div>
  );
}
