/**
 * Tango — `howToPlayV2.tangoHTP`. Symbols are the app's circle / square pair.
 *
 * Reference evidence: hint reasons enumerate "no three-in-a-row/column",
 * "equals/differs edge markers" and "row/column half-limits".
 *
 * Rules on a 6×6 board: every row and column holds three of each symbol; three
 * identical symbols may never sit consecutively in a row or column; some
 * neighbouring pairs are pinned as equal (=) or different (≠).
 */
import { createRng } from "../rng";

export const TANGO_SIZE = 6;
export type TangoSymbol = 0 | 1;

export interface TangoConstraint {
  a: number;
  b: number;
  kind: "=" | "!=";
}

export interface TangoPuzzle {
  id: string;
  seed: string;
  size: number;
  givens: Array<TangoSymbol | null>;
  constraints: TangoConstraint[];
  solution: TangoSymbol[];
}

const rowOf = (size: number, cell: number) => Math.floor(cell / size);
const colOf = (size: number, cell: number) => cell % size;

function randomFullGrid(size: number, rng: ReturnType<typeof createRng>): TangoSymbol[] | null {
  const half = size / 2;
  const grid = new Array<TangoSymbol | null>(size * size).fill(null);
  const rowCells = (row: number) => Array.from({ length: size }, (_, c) => row * size + c);
  const colCells = (col: number) => Array.from({ length: size }, (_, r) => r * size + col);

  const ok = (cell: number): boolean => {
    const row = rowOf(size, cell);
    const col = colOf(size, cell);
    for (const line of [rowCells(row), colCells(col)]) {
      const zeros = line.filter((i) => grid[i] === 0).length;
      const ones = line.filter((i) => grid[i] === 1).length;
      if (zeros > half || ones > half) return false;
      for (let i = 0; i + 2 < size; i++) {
        const [x, y, z] = [grid[line[i]], grid[line[i + 1]], grid[line[i + 2]]];
        if (x !== null && x === y && y === z) return false;
      }
    }
    return true;
  };

  const recurse = (index: number): boolean => {
    if (index === size * size) return true;
    for (const value of rng.shuffle<TangoSymbol>([0, 1])) {
      grid[index] = value;
      if (ok(index) && recurse(index + 1)) return true;
      grid[index] = null;
    }
    return false;
  };

  return recurse(0) ? (grid as TangoSymbol[]) : null;
}

/** Count solutions consistent with `givens` + `constraints`, stopping at `limit`. */
export function countTangoSolutions(
  size: number,
  givens: Array<TangoSymbol | null>,
  constraints: TangoConstraint[],
  limit = 2,
): number {
  const half = size / 2;
  const grid = [...givens];
  let found = 0;

  const constraintOk = (cell: number): boolean => {
    for (const constraint of constraints) {
      if (constraint.a !== cell && constraint.b !== cell) continue;
      const a = grid[constraint.a];
      const b = grid[constraint.b];
      if (a === null || b === null) continue;
      if (constraint.kind === "=" && a !== b) return false;
      if (constraint.kind === "!=" && a === b) return false;
    }
    return true;
  };

  const lineOk = (cell: number): boolean => {
    const row = rowOf(size, cell);
    const col = colOf(size, cell);
    for (const line of [
      Array.from({ length: size }, (_, c) => row * size + c),
      Array.from({ length: size }, (_, r) => r * size + col),
    ]) {
      const zeros = line.filter((i) => grid[i] === 0).length;
      const ones = line.filter((i) => grid[i] === 1).length;
      if (zeros > half || ones > half) return false;
      for (let i = 0; i + 2 < size; i++) {
        const [x, y, z] = [grid[line[i]], grid[line[i + 1]], grid[line[i + 2]]];
        if (x !== null && x === y && y === z) return false;
      }
    }
    return true;
  };

  const recurse = (index: number): void => {
    if (found >= limit) return;
    if (index === size * size) {
      found++;
      return;
    }
    if (grid[index] !== null) {
      if (lineOk(index) && constraintOk(index)) recurse(index + 1);
      return;
    }
    for (const value of [0, 1] as TangoSymbol[]) {
      grid[index] = value;
      if (lineOk(index) && constraintOk(index)) recurse(index + 1);
      grid[index] = null;
      if (found >= limit) return;
    }
  };

  recurse(0);
  return found;
}

export function generateTango(seed: string | number): TangoPuzzle {
  const size = TANGO_SIZE;

  for (let attempt = 0; attempt < 300; attempt++) {
    const rng = createRng(`${seed}:${attempt}`);
    const solution = randomFullGrid(size, rng);
    if (!solution) continue;

    const edges: TangoConstraint[] = [];
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const cell = row * size + col;
        if (col + 1 < size) {
          const right = cell + 1;
          edges.push({ a: cell, b: right, kind: solution[cell] === solution[right] ? "=" : "!=" });
        }
        if (row + 1 < size) {
          const down = cell + size;
          edges.push({ a: cell, b: down, kind: solution[cell] === solution[down] ? "=" : "!=" });
        }
      }
    }

    const shuffledEdges = rng.shuffle(edges);
    const allCells = rng.shuffle(Array.from({ length: size * size }, (_, i) => i));
    const givens: Array<TangoSymbol | null> = new Array(size * size).fill(null);
    const constraints: TangoConstraint[] = [];

    let edgeCursor = 0;
    let cellCursor = 0;
    for (let step = 0; step < 48; step++) {
      if (countTangoSolutions(size, givens, constraints, 2) === 1) break;
      if (step % 2 === 0 && edgeCursor < shuffledEdges.length) {
        const edge = shuffledEdges[edgeCursor++];
        if (!constraints.some((c) => c.a === edge.a && c.b === edge.b)) constraints.push(edge);
      } else if (cellCursor < allCells.length) {
        const cell = allCells[cellCursor++];
        givens[cell] = solution[cell];
      } else if (edgeCursor < shuffledEdges.length) {
        const edge = shuffledEdges[edgeCursor++];
        if (!constraints.some((c) => c.a === edge.a && c.b === edge.b)) constraints.push(edge);
      } else break;
    }

    if (countTangoSolutions(size, givens, constraints, 2) !== 1) continue;
    return { id: `tango-${size}-${String(seed)}`, seed: String(seed), size, givens, constraints, solution };
  }

  throw new Error("tango generation failed");
}

export interface TangoValidation {
  solved: boolean;
  conflicts: number[];
  filled: number;
}

export function validateTango(
  puzzle: TangoPuzzle,
  grid: Array<TangoSymbol | null>,
): TangoValidation {
  const { size, constraints } = puzzle;
  const conflictSet = new Set<number>();
  const half = size / 2;

  const pushLine = (line: number[]) => {
    const zeros = line.filter((cell) => grid[cell] === 0);
    const ones = line.filter((cell) => grid[cell] === 1);
    if (zeros.length > half) zeros.slice(half).forEach((cell) => conflictSet.add(cell));
    if (ones.length > half) ones.slice(half).forEach((cell) => conflictSet.add(cell));
    for (let i = 0; i + 2 < size; i++) {
      const [a, b, c] = [line[i], line[i + 1], line[i + 2]];
      if (grid[a] !== null && grid[a] === grid[b] && grid[b] === grid[c]) {
        conflictSet.add(a);
        conflictSet.add(b);
        conflictSet.add(c);
      }
    }
  };

  for (let row = 0; row < size; row++) pushLine(Array.from({ length: size }, (_, c) => row * size + c));
  for (let col = 0; col < size; col++) pushLine(Array.from({ length: size }, (_, r) => r * size + col));

  for (const constraint of constraints) {
    const a = grid[constraint.a];
    const b = grid[constraint.b];
    if (a === null || b === null) continue;
    if ((constraint.kind === "=" && a !== b) || (constraint.kind === "!=" && a === b)) {
      conflictSet.add(constraint.a);
      conflictSet.add(constraint.b);
    }
  }

  const filled = grid.filter((cell) => cell !== null).length;
  return { solved: filled === size * size && conflictSet.size === 0, conflicts: [...conflictSet], filled };
}
