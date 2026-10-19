/**
 * Cross Math engine — `puzzle.title.crossMath`, `nets.family.puzzleCrossMath`.
 *
 * Reference evidence: "Each row and column is a math equation that must be
 * solved using BODMAS." with a variant preset that says "No BODMAS here, do
 * calculations as you move. Always left to right."
 *
 * This engine implements the left-to-right variant (the unambiguous reading of
 * the printed operator order) and only publishes boards whose equations stay
 * non-negative and exactly divisible. Number cells sit at even row/column
 * coordinates with operators between them; the player fills the hidden numbers.
 */
import { createRng } from "../rng";
import type { Difficulty } from "../types";

export type CrossMathOp = "+" | "-" | "*" | "/";

export interface CrossMathEquation {
  orientation: "row" | "col";
  /** Grid indexes, alternating number / operator / number ... */
  cells: number[];
  target: number;
}

export interface CrossMathPuzzle {
  id: string;
  seed: string;
  size: number;
  difficulty: Difficulty;
  /** 0 on non-number cells. */
  solution: number[];
  kinds: Array<"number" | "op" | "void">;
  ops: Array<CrossMathOp | null>;
  hidden: number[];
  equations: CrossMathEquation[];
}

export const CROSSMATH_SIZE_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 3,
  medium: 3,
  hard: 5,
  expert: 5,
};

const OPS: CrossMathOp[] = ["+", "-", "*", "/"];

/** Left-to-right evaluation; null when the result is not a clean non-negative integer. */
export function evaluate(values: number[], ops: CrossMathOp[]): number | null {
  let acc = values[0];
  for (let i = 0; i < ops.length; i++) {
    const value = values[i + 1];
    switch (ops[i]) {
      case "+":
        acc += value;
        break;
      case "-":
        acc -= value;
        break;
      case "*":
        acc *= value;
        break;
      case "/":
        if (value === 0 || acc % value !== 0) return null;
        acc /= value;
        break;
    }
    if (!Number.isInteger(acc) || acc < 0) return null;
  }
  return acc;
}

export function generateCrossMath(
  seed: string | number,
  difficulty: Difficulty = "easy",
  sizeOverride?: number,
): CrossMathPuzzle {
  const size = sizeOverride ?? CROSSMATH_SIZE_BY_DIFFICULTY[difficulty];

  for (let attempt = 0; attempt < 80; attempt++) {
    const rng = createRng(`${seed}:${attempt}`);
    const kinds: Array<"number" | "op" | "void"> = [];
    const ops: Array<CrossMathOp | null> = [];
    const solution = new Array<number>(size * size).fill(0);

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const isNumber = r % 2 === 0 && c % 2 === 0;
        const isOp = (r % 2 === 1) !== (c % 2 === 1);
        kinds.push(isNumber ? "number" : isOp ? "op" : "void");
        ops.push(isOp ? rng.pick(OPS) : null);
        if (isNumber) solution[r * size + c] = 1 + rng.int(9);
      }
    }

    const equations: CrossMathEquation[] = [];
    let ok = true;

    const build = (orientation: "row" | "col", fixed: number) => {
      const cells: number[] = [];
      const values: number[] = [];
      const chosen: CrossMathOp[] = [];
      for (let step = 0; step < size; step++) {
        const r = orientation === "row" ? fixed : step;
        const c = orientation === "row" ? step : fixed;
        const index = r * size + c;
        if (kinds[index] === "void") continue;
        cells.push(index);
        if (kinds[index] === "number") values.push(solution[index]);
        else chosen.push(ops[index] as CrossMathOp);
      }
      const target = evaluate(values, chosen);
      if (target === null || target > 999) {
        ok = false;
        return;
      }
      equations.push({ orientation, cells, target });
    };

    for (let r = 0; r < size; r += 2) build("row", r);
    for (let c = 0; c < size; c += 2) build("col", c);
    if (!ok) continue;

    const numberCells = kinds
      .map((kind, index) => (kind === "number" ? index : -1))
      .filter((index) => index >= 0);
    const hideRatio = difficulty === "easy" ? 0.4 : difficulty === "medium" ? 0.5 : 0.6;
    const hideCount = Math.max(1, Math.round(numberCells.length * hideRatio));
    const hidden = rng.shuffle(numberCells).slice(0, hideCount);

    return {
      id: `crossmath-${size}-${difficulty}-${String(seed)}`,
      seed: String(seed),
      size,
      difficulty,
      solution,
      kinds,
      ops,
      hidden,
      equations,
    };
  }

  throw new Error("cross math generation failed");
}

export interface CrossMathValidation {
  solved: boolean;
  wrong: number[];
  filled: number;
  total: number;
}

/** `grid` holds the player's number values; non-number cells are ignored. */
export function validateCrossMath(puzzle: CrossMathPuzzle, grid: number[]): CrossMathValidation {
  const wrong: number[] = [];
  let filled = 0;
  for (const index of puzzle.hidden) if (grid[index] > 0) filled++;

  for (const equation of puzzle.equations) {
    const values: number[] = [];
    const ops: CrossMathOp[] = [];
    for (const index of equation.cells) {
      if (puzzle.kinds[index] === "number") values.push(grid[index]);
      else ops.push(puzzle.ops[index] as CrossMathOp);
    }
    if (values.some((v) => v <= 0)) continue;
    if (evaluate(values, ops) !== equation.target) {
      wrong.push(...equation.cells.filter((i) => puzzle.kinds[i] === "number"));
    }
  }

  return {
    solved: filled === puzzle.hidden.length && wrong.length === 0,
    wrong: [...new Set(wrong)],
    filled,
    total: puzzle.hidden.length,
  };
}
