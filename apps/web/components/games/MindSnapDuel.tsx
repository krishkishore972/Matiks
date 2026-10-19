"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRng } from "../../lib/rng";
import { mindSnapBoard, mindSnapScore } from "../../lib/games/reflex";
import { cn } from "../../lib/utils/cn";
import { formatClock } from "../../lib/utils/cn";
import { Grid } from "./parts";
import type { BoardProps } from "./types";

const FLASH_MS = 1200;

/**
 * Mind Snap. Presets are `<grid>G(<squares>S)` — the default session is
 * `25G(9S)`: a 5×5 grid with 9 lit tiles. Each correct tap is +1, each wrong tap
 * −1, and you get only as many taps as highlighted tiles. 60 seconds of boards.
 */
export function MindSnapDuel({
  seed,
  durationMs,
  session,
  onSolved,
}: BoardProps & { seed: string; durationMs: number }) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"flash" | "recall">("flash");
  const [taps, setTaps] = useState<number[]>([]);
  const [points, setPoints] = useState(0);
  const finished = useRef(false);

  const board = useMemo(() => mindSnapBoard(createRng(`${seed}:${index}`), 5, 9), [seed, index]);

  const endSession = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    session.finish();
    onSolved({ points });
  }, [onSolved, points, session]);

  // Board lifecycle: flash, then recall until every tap is used.
  useEffect(() => {
    if (!session.running || phase !== "flash") return;
    const id = window.setTimeout(() => setPhase("recall"), FLASH_MS);
    return () => window.clearTimeout(id);
  }, [phase, session.running, index]);

  useEffect(() => {
    if (!session.running || phase !== "recall") return;
    if (taps.length < board.squares) return;
    const score = mindSnapScore(taps, board.highlighted);
    setPoints((current) => current + score.points);
    session.addCorrect(score.hits);
    session.addMistake(score.misses + score.extraTaps);
    setTaps([]);
    setPhase("flash");
    setIndex((current) => current + 1);
  }, [taps, phase, board, session]);

  useEffect(() => {
    if (!session.running || finished.current) return;
    if (session.elapsedMs >= durationMs) endSession();
  }, [session.elapsedMs, session.running, durationMs, endSession]);

  function tap(cell: number) {
    if (!session.running || phase !== "recall") return;
    if (taps.includes(cell) || taps.length >= board.squares) return;
    setTaps((current) => [...current, cell]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="tabular text-sm font-semibold text-lime-brand">{points} pts</span>
        <span className="text-xs text-ink-400">Board {index + 1} · {board.presetId}</span>
        <span className="tabular text-sm font-semibold text-ink-200">
          {formatClock(Math.max(0, durationMs - session.elapsedMs))}
        </span>
      </div>

      <p className="text-center text-xs font-semibold text-ink-300">
        {phase === "flash" ? "Memorise the lit tiles…" : `Tap the ${board.squares} tiles you just saw`}
      </p>

      <Grid size={board.size} gap={4}>
        {Array.from({ length: board.size * board.size }, (_, cell) => {
          const lit = phase === "flash" && board.highlighted.includes(cell);
          const tapped = taps.includes(cell);
          return (
            <button
              key={cell}
              type="button"
              onClick={() => tap(cell)}
              aria-label={`Tile ${cell + 1}`}
              className={cn(
                "aspect-square rounded-lg transition",
                lit ? "bg-lime-brand" : "bg-ink-800",
                tapped && !lit && "bg-violet",
                phase === "recall" && !tapped && "hover:bg-ink-700",
              )}
            />
          );
        })}
      </Grid>

      <p className="text-[11px] text-ink-400">
        {taps.length} of {board.squares} taps used · {session.mistakes} wrong tap
        {session.mistakes === 1 ? "" : "s"}.
      </p>
    </div>
  );
}
