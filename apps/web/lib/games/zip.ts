/**
 * Zip — `howToPlayV2.zipHTP`, `classifyZipFailReason`.
 *
 * Reference evidence: the hint copy distinguishes the two failure modes (the
 * path does not cover every playable cell vs. a checkpoint reached out of
 * order), and the app calls the numbered cells "checkpoints".
 *
 * Mechanic: draw one continuous path that starts on 1, visits every numbered
 * checkpoint in ascending order and covers every cell exactly once.
 */
import { createRng } from "../rng";

export interface ZipPuzzle {
  id: string;
  seed: string;
  size: number;
  /** Checkpoint number per cell, or 0. */
  checkpoints: number[];
  start: number;
  end: number;
  /** One valid path, as a list of cell indexes. */
  solution: number[];
}

const SIZES = [5, 6];

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

/** Randomized Hamiltonian path with a Warnsdorff-style ordering. */
function hamiltonianPath(size: number, rng: ReturnType<typeof createRng>): number[] | null {
  const total = size * size;
  const start = rng.int(total);
  const path: number[] = [start];
  const visited = new Set<number>([start]);

  const warnsdorff = (cell: number) => neighbours(size, cell).filter((n) => !visited.has(n)).length;

  const recurse = (): boolean => {
    if (path.length === total) return true;
    const current = path[path.length - 1];
    const options = neighbours(size, current)
      .filter((n) => !visited.has(n))
      .sort((a, b) => warnsdorff(a) - warnsdorff(b));
    for (const next of rng.shuffle(options.slice(0, Math.min(3, options.length)))) {
      visited.add(next);
      path.push(next);
      if (recurse()) return true;
      visited.delete(next);
      path.pop();
    }
    return false;
  };

  return recurse() ? path : null;
}

/**
 * Count paths consistent with the checkpoints, stopping at `limit` or when the
 * node budget is exhausted (`budgetExhausted` then means "not proven unique").
 */
export function countZipPaths(
  puzzle: Pick<ZipPuzzle, "size" | "checkpoints">,
  limit = 2,
  budget = 400_000,
): { count: number; budgetExhausted: boolean } {
  const { size, checkpoints } = puzzle;
  const total = size * size;
  const checkpointOrder = new Map<number, number>();
  let maxCheckpoint = 0;
  checkpoints.forEach((value, cell) => {
    if (value > 0) {
      checkpointOrder.set(cell, value);
      maxCheckpoint = Math.max(maxCheckpoint, value);
    }
  });
  const entries = [...checkpointOrder.entries()];
  const startCell = entries.find(([, v]) => v === 1)?.[0];
  const endCell = entries.find(([, v]) => v === maxCheckpoint)?.[0];
  if (startCell === undefined || endCell === undefined) return { count: 0, budgetExhausted: false };

  const visited = new Set<number>([startCell]);
  let steps = 0;
  let found = 0;
  let exhausted = false;

  const recurse = (cell: number): void => {
    if (found >= limit) return;
    if (steps++ > budget) {
      exhausted = true;
      found = limit;
      return;
    }
    if (visited.size === total) {
      if (cell === endCell) found++;
      return;
    }
    for (const next of neighbours(size, cell)) {
      if (visited.has(next)) continue;
      const checkpoint = checkpointOrder.get(next);
      if (checkpoint !== undefined) {
        const passed = [...visited].filter((c) => checkpointOrder.has(c)).length;
        if (checkpoint !== passed + 1) continue;
      }
      visited.add(next);
      recurse(next);
      visited.delete(next);
      if (found >= limit) return;
    }
  };

  recurse(startCell);
  return { count: found, budgetExhausted: exhausted };
}

export function generateZip(seed: string | number, sizeOverride?: number): ZipPuzzle {
  const baseRng = createRng(seed);
  const size = sizeOverride ?? baseRng.pick(SIZES);

  for (let attempt = 0; attempt < 200; attempt++) {
    const rng = createRng(`${seed}:${attempt}`);
    const solution = hamiltonianPath(size, rng);
    if (!solution) continue;

    for (const checkpointCount of [4, 5, 6, 7]) {
      if (checkpointCount > solution.length) break;
      const checkpoints = new Array<number>(size * size).fill(0);
      const stride = (solution.length - 1) / (checkpointCount - 1);
      for (let i = 0; i < checkpointCount; i++) {
        const index = i === checkpointCount - 1 ? solution.length - 1 : Math.round(i * stride);
        checkpoints[solution[index]] = i + 1;
      }

      const { count, budgetExhausted } = countZipPaths({ size, checkpoints }, 2, 250_000);
      if (count !== 1 && !budgetExhausted) continue;

      return {
        id: `zip-${size}-${String(seed)}`,
        seed: String(seed),
        size,
        checkpoints,
        start: solution[0],
        end: solution[solution.length - 1],
        solution,
      };
    }
  }

  throw new Error("zip generation failed");
}

export type ZipFailReason = "incomplete" | "wrong-order" | "ok";

/** Mirrors `classifyZipFailReason` from the reference bundle. */
export function classifyZipFailReason(puzzle: ZipPuzzle, path: number[]): ZipFailReason {
  if (path.length !== puzzle.size * puzzle.size) return "incomplete";
  let expected = 1;
  for (const cell of path) {
    const checkpoint = puzzle.checkpoints[cell];
    if (checkpoint > 0) {
      if (checkpoint !== expected) return "wrong-order";
      expected++;
    }
  }
  return "ok";
}

export interface ZipValidation {
  solved: boolean;
  reason: ZipFailReason;
  /** Path positions where the drawn path is illegal. */
  illegal: number[];
}

export function validateZip(puzzle: ZipPuzzle, path: number[]): ZipValidation {
  const illegal: number[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < path.length; i++) {
    const cell = path[i];
    if (seen.has(cell)) illegal.push(i);
    seen.add(cell);
    if (i > 0 && !neighbours(puzzle.size, path[i - 1]).includes(cell)) illegal.push(i);
  }

  const reason = classifyZipFailReason(puzzle, path);
  return {
    solved: illegal.length === 0 && reason === "ok",
    reason: illegal.length > 0 ? "incomplete" : reason,
    illegal: [...new Set(illegal)],
  };
}
