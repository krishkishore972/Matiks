"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { accuracyFrom } from "../scoring";

export type SessionStatus = "ready" | "playing" | "finished";

export interface GameSession {
  status: SessionStatus;
  elapsedMs: number;
  correct: number;
  mistakes: number;
  accuracy: number;
  /** True while the clock is running. */
  running: boolean;
  start: () => void;
  finish: () => void;
  reset: () => void;
  addCorrect: (count?: number) => void;
  addMistake: (count?: number) => void;
}

/**
 * One stopwatch + accuracy ledger for a single attempt.
 *
 * Accuracy follows the reference app's redefinition: every wrong answer,
 * backspace, clear and retry counts as a mistake, so accuracy is
 * `correct / (correct + mistakes)` rather than "did you eventually get it".
 */
export function useGameSession(): GameSession {
  const [status, setStatus] = useState<SessionStatus>("ready");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (status !== "playing") return;
    const id = window.setInterval(() => {
      if (startedAt.current !== null) setElapsedMs(Date.now() - startedAt.current);
    }, 100);
    return () => window.clearInterval(id);
  }, [status]);

  const start = useCallback(() => {
    startedAt.current = Date.now();
    setElapsedMs(0);
    setCorrect(0);
    setMistakes(0);
    setStatus("playing");
  }, []);

  const finish = useCallback(() => {
    if (startedAt.current !== null) setElapsedMs(Date.now() - startedAt.current);
    setStatus("finished");
  }, []);

  const reset = useCallback(() => {
    startedAt.current = null;
    setElapsedMs(0);
    setCorrect(0);
    setMistakes(0);
    setStatus("ready");
  }, []);

  const addCorrect = useCallback((count = 1) => setCorrect((value) => value + count), []);
  const addMistake = useCallback((count = 1) => setMistakes((value) => value + count), []);

  return useMemo(
    () => ({
      status,
      elapsedMs,
      correct,
      mistakes,
      accuracy: accuracyFrom(correct, mistakes),
      running: status === "playing",
      start,
      finish,
      reset,
      addCorrect,
      addMistake,
    }),
    [status, elapsedMs, correct, mistakes, start, finish, reset, addCorrect, addMistake],
  );
}
