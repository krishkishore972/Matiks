"use client";

import { useState } from "react";
import { validateHectoc, type HectocPuzzle } from "../../lib/games/hectoc";
import { cn } from "../../lib/utils/cn";
import type { BoardProps } from "./types";

type Token = string;

export function HectocBoard({
  puzzle,
  session,
  onSolved,
}: BoardProps & { puzzle: HectocPuzzle }) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const expression = tokens.join("");
  const digitsUsed = tokens.filter((token) => /^\d+$/.test(token)).length;

  function push(token: Token) {
    if (!session.running) return;
    setTokens((current) => [...current, token]);
    setFeedback(null);
  }

  function backspace() {
    if (!session.running || tokens.length === 0) return;
    setTokens((current) => current.slice(0, -1));
    session.addMistake();
    setFeedback(null);
  }

  function submit() {
    const verdict = validateHectoc(puzzle, expression);
    if (verdict.ok) {
      session.addCorrect();
      onSolved({ digits: puzzle.digits.join("") });
      return;
    }
    session.addMistake();
    if (verdict.reason === "digits") setFeedback("Use the six digits in order, exactly once each.");
    else if (verdict.reason === "syntax") setFeedback("That expression doesn't parse. Check your brackets.");
    else setFeedback(`That equals ${verdict.value?.toFixed(2)} — the target is ${puzzle.target}.`);
  }

  const digitTokens = puzzle.digits
    .slice(digitsUsed, digitsUsed + 3)
    .map((digit, offset) => ({ digit, primary: offset === 0 }));

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-ink-900/70 p-3">
        <p className="text-[11px] font-semibold tracking-wide text-ink-300 uppercase">
          Build an expression equal to {puzzle.target}
        </p>
        <p className="tabular mt-1 min-h-8 text-xl font-bold break-all text-ink-50">
          {expression || <span className="text-ink-500">tap digits and operators…</span>}
        </p>
        <p className="mt-1 text-[11px] text-ink-400">
          Digits {puzzle.digits.join(" · ")} must be used in order.
        </p>
      </div>

      {feedback ? (
        <p className="rounded-xl bg-berry/15 px-3 py-2 text-xs font-semibold text-berry">{feedback}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {digitTokens.map(({ digit, primary }) => (
          <button
            key={`${digit}-${digitsUsed}`}
            type="button"
            onClick={() => push(String(digit))}
            className={cn(
              "tabular min-w-11 flex-1 rounded-xl py-2.5 text-base font-bold transition active:scale-95",
              primary ? "bg-lime-brand text-lime-ink" : "bg-ink-800 text-ink-400",
            )}
          >
            {digit}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {["+", "-", "*", "/"].map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => push(op)}
            className="tabular min-w-11 flex-1 rounded-xl bg-ink-800 py-2.5 text-lg font-bold text-gold hover:bg-ink-700 active:scale-95"
          >
            {op === "*" ? "×" : op === "/" ? "÷" : op}
          </button>
        ))}
        <button
          type="button"
          onClick={() => push("(")}
          className="tabular min-w-11 flex-1 rounded-xl bg-ink-800 py-2.5 text-lg font-bold text-sky hover:bg-ink-700"
        >
          (
        </button>
        <button
          type="button"
          onClick={() => push(")")}
          className="tabular min-w-11 flex-1 rounded-xl bg-ink-800 py-2.5 text-lg font-bold text-sky hover:bg-ink-700"
        >
          )
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={backspace}
          className="flex-1 rounded-xl bg-ink-800 py-2.5 text-xs font-semibold text-ink-200 hover:bg-ink-700"
        >
          Backspace (mistake)
        </button>
        <button
          type="button"
          onClick={() => {
            if (tokens.length === 0) return;
            setTokens([]);
            session.addMistake();
            setFeedback(null);
          }}
          className="flex-1 rounded-xl bg-ink-800 py-2.5 text-xs font-semibold text-ink-200 hover:bg-ink-700"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={submit}
          className="flex-1 rounded-xl bg-lime-brand py-2.5 text-xs font-bold text-lime-ink hover:bg-lime-soft"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
