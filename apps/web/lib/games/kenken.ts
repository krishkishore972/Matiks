/**
 * KenKen engine — `puzzle.title.kenKen`, `nets.family.puzzleKenKen`.
 *
 * Reference evidence (verbatim from the bundle):
 *   "You'll see heavily outlined areas called \"cages.\" These contain one or
 *    more squares."
 *   "Each cage has a \"clue\" in the corner: a target number and a mathematical
 *    operation (+, -, ×, ÷)."
 *   "Each number must appear exactly once in each row/column."
 *   "+10 in three squares could be 1,4,5"; "÷2 two squares → {4,2} or {2,1}";
 *   "Order does not matter for subtraction and division!"
 */
import { createRng, type Rng } from "../rng";
import type { Difficulty } from "../types";

export type KenKenOp = "+" | "-" | "*" | "/" | "=";

export interface KenKenCage {
  id: number;
  cells: number[];
  target: number;
  op: KenKenOp;
}

export interface KenKenPuzzle {
  id: string;
  seed: string;
  size: number;
  difficulty: Difficulty;
  solution: number[];
  cages: KenKenCage[];
}

export const KENKEN_SIZE_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 4,
  medium: 4,
  hard: 6,
  expert: 6,
};

function latinSquare(size: number, rng: Rng): number[] {
  const grid = new Array<number>(size * size).fill(0);
  const ok = (index: number, value: number): boolean => {
    const row = Math.floor(index / size);
    const col = index % size;
    for (let i = 0; i < size; i++) {
      if (grid[row * size + i] === value) return false;
      if (grid[i * size + col] === value) return false;
    }
    return true;
  };
  const recurse = (index: number): boolean => {
    if (index === size * size) return true;
    for (const value of rng.shuffle(Array.from({ length: size }, (_, i) => i + 1))) {
      if (ok(index, value)) {
        grid[index] = value;
        if (recurse(index + 1)) return true;
        grid[index] = 0;
      }
    }
    return false;
  };
  recurse(0);
  return grid;
}

function neighbours(size: number, index: number): number[] {
  const row = Math.floor(index / size);
  const col = index % size;
  const out: number[] = [];
  if (row > 0) out.push(index - size);
  if (row < size - 1) out.push(index + size);
  if (col > 0) out.push(index - 1);
  if (col < size - 1) out.push(index + 1);
  return out;
}

function describeCage(values: number[], rng: Rng): { target: number; op: KenKenOp } {
  if (values.length === 1) return { target: values[0], op: "=" };
  const sum = values.reduce((a, b) => a + b, 0);
  const product = values.reduce((a, b) => a * b, 1);
  const options: Array<{ target: number; op: KenKenOp }> = [
    { target: sum, op: "+" },
    { target: product, op: "*" },
  ];
  if (values.length === 2) {
    const [a, b] = values;
    options.push({ target: Math.abs(a - b), op: "-" });
    const big = Math.max(a, b);
    const small = Math.min(a, b);
    if (small > 0 && big % small === 0) options.push({ target: big / small, op: "/" });
  }
  const weighted = values.length >= 3 ? [...options, options[1], options[0]] : [...options, options[0]];
  return rng.pick(weighted);
}

export function generateKenKen(
  seed: string | number,
  difficulty: Difficulty = "easy",
  sizeOverride?: number,
): KenKenPuzzle {
  const rng = createRng(seed);
  const size = sizeOverride ?? KENKEN_SIZE_BY_DIFFICULTY[difficulty];
  const solution = latinSquare(size, rng);

  const unassigned = new Set(Array.from({ length: size * size }, (_, i) => i));
  const cages: KenKenCage[] = [];
  let cageId = 0;

  while (unassigned.size > 0) {
    const start = rng.pick([...unassigned]);
    const maxSize = size <= 4 ? 3 : 4;
    const targetSize = 1 + rng.int(maxSize);
    const cells = [start];
    unassigned.delete(start);

    while (cells.length < targetSize) {
      const frontier = cells
        .flatMap((cell) => neighbours(size, cell))
        .filter((cell) => unassigned.has(cell));
      if (frontier.length === 0) break;
      const next = rng.pick(frontier);
      cells.push(next);
      unassigned.delete(next);
    }

    const values = cells.map((cell) => solution[cell]);
    const { target, op } = describeCage(values, rng);
    cages.push({ id: cageId++, cells, target, op });
  }

  return {
    id: `kenken-${size}-${difficulty}-${String(seed)}`,
    seed: String(seed),
    size,
    difficulty,
    solution,
    cages,
  };
}

export function cageSatisfied(cage: KenKenCage, values: number[]): boolean {
  if (values.some((v) => v === 0)) return false;
  if (new Set(values).size !== values.length) return false;
  switch (cage.op) {
    case "=":
      return values.length === 1 && values[0] === cage.target;
    case "+":
      return values.reduce((a, b) => a + b, 0) === cage.target;
    case "*":
      return values.reduce((a, b) => a * b, 1) === cage.target;
    case "-":
      return values.length === 2 && Math.abs(values[0] - values[1]) === cage.target;
    case "/": {
      if (values.length !== 2) return false;
      const big = Math.max(values[0], values[1]);
      const small = Math.min(values[0], values[1]);
      return small !== 0 && big % small === 0 && big / small === cage.target;
    }
  }
}

export interface KenKenValidation {
  solved: boolean;
  rowConflicts: number[];
  colConflicts: number[];
  cageViolations: number[];
  filled: number;
}

export function validateKenKen(puzzle: KenKenPuzzle, grid: number[]): KenKenValidation {
  const size = puzzle.size;
  const rowConflicts: number[] = [];
  const colConflicts: number[] = [];

  const register = (list: number[], group: number[]) => {
    const seen = new Map<number, number[]>();
    for (const index of group) {
      const value = grid[index];
      if (!value) continue;
      const bucket = seen.get(value) ?? [];
      bucket.push(index);
      seen.set(value, bucket);
    }
    for (const bucket of seen.values()) if (bucket.length > 1) list.push(...bucket);
  };

  for (let row = 0; row < size; row++) {
    register(rowConflicts, Array.from({ length: size }, (_, c) => row * size + c));
  }
  for (let col = 0; col < size; col++) {
    register(colConflicts, Array.from({ length: size }, (_, r) => r * size + col));
  }

  const cageViolations: number[] = [];
  for (const cage of puzzle.cages) {
    const values = cage.cells.map((cell) => grid[cell]);
    if (values.every((v) => v > 0) && !cageSatisfied(cage, values)) {
      cageViolations.push(...cage.cells);
    }
  }

  const filled = grid.filter((v) => v > 0).length;
  return {
    solved:
      filled === size * size &&
      rowConflicts.length === 0 &&
      colConflicts.length === 0 &&
      cageViolations.length === 0,
    rowConflicts,
    colConflicts,
    cageViolations,
    filled,
  };
}

/** Solver used by tests to prove generated boards are solvable. */
export function solveKenKen(
  puzzle: KenKenPuzzle,
  givens: number[] = new Array(puzzle.size * puzzle.size).fill(0),
  limit = 2,
): number[][] {
  const size = puzzle.size;
  const grid = [...givens];
  const solutions: number[][] = [];
  const cageOf = new Map<number, KenKenCage>();
  for (const cage of puzzle.cages) for (const cell of cage.cells) cageOf.set(cell, cage);

  const usedInRow: Array<Set<number>> = Array.from({ length: size }, () => new Set());
  const usedInCol: Array<Set<number>> = Array.from({ length: size }, () => new Set());
  for (let i = 0; i < size * size; i++) {
    const value = grid[i];
    if (value > 0) {
      usedInRow[Math.floor(i / size)].add(value);
      usedInCol[i % size].add(value);
    }
  }

  const cageOk = (cage: KenKenCage): boolean => {
    const values = cage.cells.map((cell) => grid[cell]);
    if (values.some((v) => v === 0)) return true;
    return cageSatisfied(cage, values);
  };

  const recurse = (index: number): void => {
    if (solutions.length >= limit) return;
    if (index === size * size) {
      solutions.push([...grid]);
      return;
    }
    if (grid[index] > 0) {
      recurse(index + 1);
      return;
    }
    const row = Math.floor(index / size);
    const col = index % size;
    const cage = cageOf.get(index)!;
    for (let value = 1; value <= size; value++) {
      if (usedInRow[row].has(value) || usedInCol[col].has(value)) continue;
      grid[index] = value;
      usedInRow[row].add(value);
      usedInCol[col].add(value);
      if (cageOk(cage)) recurse(index + 1);
      usedInRow[row].delete(value);
      usedInCol[col].delete(value);
      grid[index] = 0;
    }
  };

  recurse(0);
  return solutions;
}

/** Cell-to-cage lookup for rendering the heavy cage outlines. */
export function cageIndexByCell(puzzle: KenKenPuzzle): number[] {
  const map = new Array<number>(puzzle.size * puzzle.size).fill(-1);
  puzzle.cages.forEach((cage, cageIndex) => {
    for (const cell of cage.cells) map[cell] = cageIndex;
  });
  return map;
}
