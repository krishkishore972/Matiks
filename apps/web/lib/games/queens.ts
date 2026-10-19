/**
 * Queens — an `infinitePuzzle` game (`howToPlayV2.queensHTP`, `QUEENS_COLORS`).
 *
 * Reference evidence: "Queens 👑 can't touch, not even diagonally." Regions are
 * coloured and hints cover row/column/region/adjacency locks.
 *
 * Rules: place one queen per row, per column and per colour region; queens may
 * not touch each other, including diagonally.
 */
import { createRng } from "../rng";

export interface QueensPuzzle {
  id: string;
  seed: string;
  size: number;
  /** Region id per cell (0..size-1). */
  regions: number[];
  /** Solution: the queen's column for each row. */
  solution: number[];
}

const SIZES = [6, 7, 8];

function findPlacement(size: number, rng: ReturnType<typeof createRng>): number[] | null {
  const cols = new Set<number>();
  const placement: number[] = [];

  const recurse = (row: number): boolean => {
    if (row === size) return true;
    for (const col of rng.shuffle(Array.from({ length: size }, (_, i) => i))) {
      if (cols.has(col)) continue;
      const previous = placement[row - 1];
      if (previous !== undefined && Math.abs(previous - col) === 1) continue;
      placement[row] = col;
      cols.add(col);
      if (recurse(row + 1)) return true;
      cols.delete(col);
    }
    return false;
  };

  return recurse(0) ? placement : null;
}

/**
 * Grow `size` contiguous regions from the solution cells so every region holds
 * exactly one queen. Randomised flood fill guarantees contiguity.
 */
function buildRegions(
  size: number,
  solution: number[],
  rng: ReturnType<typeof createRng>,
): number[] {
  const regions = new Array<number>(size * size).fill(-1);
  const frontier: Array<{ cell: number; region: number }> = [];

  solution.forEach((col, row) => {
    const cell = row * size + col;
    regions[cell] = row;
    frontier.push({ cell, region: row });
  });

  const neighbours = (cell: number): number[] => {
    const row = Math.floor(cell / size);
    const col = cell % size;
    const out: number[] = [];
    if (row > 0) out.push(cell - size);
    if (row < size - 1) out.push(cell + size);
    if (col > 0) out.push(cell - 1);
    if (col < size - 1) out.push(cell + 1);
    return out;
  };

  let guard = 0;
  while (frontier.length > 0 && guard++ < size * size * 30) {
    const pickIndex = rng.int(frontier.length);
    const { cell, region } = frontier[pickIndex];
    const options = neighbours(cell).filter((n) => regions[n] === -1);
    if (options.length === 0) {
      frontier.splice(pickIndex, 1);
      continue;
    }
    const next = rng.pick(options);
    regions[next] = region;
    frontier.push({ cell: next, region });
  }

  for (let cell = 0; cell < size * size; cell++) {
    if (regions[cell] !== -1) continue;
    const neighbour = neighbours(cell).find((n) => regions[n] !== -1);
    regions[cell] = neighbour === undefined ? rng.int(size) : regions[neighbour];
  }

  return regions;
}

/** Count valid queen placements, stopping at `limit`. */
export function countQueensSolutions(size: number, regions: number[], limit = 2): number {
  const usedCols = new Set<number>();
  const usedRegions = new Set<number>();
  const placement: number[] = [];
  let found = 0;

  const recurse = (row: number): void => {
    if (found >= limit) return;
    if (row === size) {
      found++;
      return;
    }
    for (let col = 0; col < size; col++) {
      if (usedCols.has(col)) continue;
      const region = regions[row * size + col];
      if (usedRegions.has(region)) continue;
      const previous = placement[row - 1];
      if (previous !== undefined && Math.abs(previous - col) === 1) continue;
      placement[row] = col;
      usedCols.add(col);
      usedRegions.add(region);
      recurse(row + 1);
      usedCols.delete(col);
      usedRegions.delete(region);
      if (found >= limit) return;
    }
  };

  recurse(0);
  return found;
}

export function generateQueens(seed: string | number, sizeOverride?: number): QueensPuzzle {
  const baseRng = createRng(seed);
  const size = sizeOverride ?? baseRng.pick(SIZES);

  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = createRng(`${seed}:${attempt}`);
    const solution = findPlacement(size, rng);
    if (!solution) continue;
    const regions = buildRegions(size, solution, rng);
    if (countQueensSolutions(size, regions, 2) !== 1) continue;
    return { id: `queens-${size}-${String(seed)}`, seed: String(seed), size, regions, solution };
  }
  throw new Error("queens generation failed");
}

export interface QueensValidation {
  solved: boolean;
  conflicts: number[];
  placed: number;
}

/** `queens` is the list of occupied cell indexes. */
export function validateQueens(puzzle: QueensPuzzle, queens: number[]): QueensValidation {
  const { size, regions } = puzzle;
  const conflicts = new Set<number>();
  const byRow = new Map<number, number>();
  const byCol = new Map<number, number>();
  const byRegion = new Map<number, number>();

  for (const cell of queens) {
    const row = Math.floor(cell / size);
    const col = cell % size;
    const region = regions[cell];
    if (byRow.has(row)) {
      conflicts.add(cell);
      conflicts.add(byRow.get(row)!);
    } else byRow.set(row, cell);
    if (byCol.has(col)) {
      conflicts.add(cell);
      conflicts.add(byCol.get(col)!);
    } else byCol.set(col, cell);
    if (byRegion.has(region)) {
      conflicts.add(cell);
      conflicts.add(byRegion.get(region)!);
    } else byRegion.set(region, cell);
  }

  for (let i = 0; i < queens.length; i++) {
    for (let j = i + 1; j < queens.length; j++) {
      const a = queens[i];
      const b = queens[j];
      const dRow = Math.abs(Math.floor(a / size) - Math.floor(b / size));
      const dCol = Math.abs((a % size) - (b % size));
      if (dRow <= 1 && dCol <= 1 && (dRow !== 0 || dCol !== 0)) {
        conflicts.add(a);
        conflicts.add(b);
      }
    }
  }

  return { solved: queens.length === size && conflicts.size === 0, conflicts: [...conflicts], placed: queens.length };
}
