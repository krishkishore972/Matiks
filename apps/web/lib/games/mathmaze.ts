/**
 * Math Maze engine — `puzzle.title.mathMaze`, `nets.family.puzzleMathMaze`.
 *
 * Reference evidence: "Solve the maze so your path equals this total." with the
 * steps "Make a Path", "Left to Right", "Finish Strong".
 *
 * Mechanic: an n×n grid of digits. The player picks exactly one cell per row,
 * starting on the highlighted entry cell in the top row and finishing on the
 * highlighted exit cell in the bottom row, moving at most one column sideways
 * each step. The chosen digits must add up to the printed target. Boards are
 * only published when exactly one path reaches the target (exact DP count).
 */
import { createRng } from "../rng";
import type { Difficulty } from "../types";

export interface MathMazePuzzle {
  id: string;
  seed: string;
  size: number;
  difficulty: Difficulty;
  /** Row-major digits, 1..9. */
  cells: number[];
  entryCol: number;
  exitCol: number;
  target: number;
  solutionPath: number[];
}

export const MATHMAZE_SIZE_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 4,
  medium: 5,
  hard: 6,
  expert: 6,
};

/**
 * Exact path count: backwards DP over (row, column) → map of path sum → ways.
 * Only paths that end on `exitCol` are counted.
 */
export function countMazePaths(
  size: number,
  cells: number[],
  entryCol: number,
  exitCol: number,
): Map<number, number> {
  const dp: Array<Array<Map<number, number>>> = [];
  for (let row = size - 1; row >= 0; row--) {
    dp[row] = [];
    for (let col = 0; col < size; col++) {
      const totals = new Map<number, number>();
      if (row === size - 1) {
        if (col === exitCol) totals.set(cells[row * size + col], 1);
      } else {
        for (const next of [col - 1, col, col + 1]) {
          if (next < 0 || next >= size) continue;
          for (const [sum, ways] of dp[row + 1][next]) {
            const key = sum + cells[row * size + col];
            totals.set(key, (totals.get(key) ?? 0) + ways);
          }
        }
      }
      dp[row][col] = totals;
    }
  }
  return dp[0][entryCol];
}

function pathSum(cells: number[], size: number, path: number[]): number {
  return path.reduce((acc, col, row) => acc + cells[row * size + col], 0);
}

export function generateMathMaze(
  seed: string | number,
  difficulty: Difficulty = "easy",
): MathMazePuzzle {
  const size = MATHMAZE_SIZE_BY_DIFFICULTY[difficulty];

  for (let attempt = 0; attempt < 120; attempt++) {
    const rng = createRng(`${seed}:${attempt}`);
    const entryCol = rng.int(size);
    const exitCol = rng.int(size);

    const path: number[] = [entryCol];
    for (let row = 1; row < size; row++) {
      const prev = path[row - 1];
      const remaining = size - 1 - row;
      const options = [prev - 1, prev, prev + 1].filter((col) => {
        if (col < 0 || col >= size) return false;
        if (remaining === 0 && col !== exitCol) return false;
        return Math.abs(col - exitCol) <= remaining;
      });
      if (options.length === 0) break;
      path.push(rng.pick(options));
    }
    if (path.length !== size) continue;

    const cells = Array.from({ length: size * size }, () => 1 + rng.int(9));
    const target = pathSum(cells, size, path);
    const totals = countMazePaths(size, cells, entryCol, exitCol);
    if ((totals.get(target) ?? 0) !== 1) continue;

    return {
      id: `mathmaze-${size}-${difficulty}-${String(seed)}`,
      seed: String(seed),
      size,
      difficulty,
      cells,
      entryCol,
      exitCol,
      target,
      solutionPath: path,
    };
  }

  throw new Error("math maze generation failed");
}

export interface MathMazeValidation {
  solved: boolean;
  filled: number;
  sum: number;
  illegalSteps: number[];
}

/** `selection[row]` is the chosen column in that row, or -1 when unset. */
export function validateMathMaze(
  puzzle: MathMazePuzzle,
  selection: number[],
): MathMazeValidation {
  const illegalSteps: number[] = [];
  let filled = 0;
  let sum = 0;
  let previous: number | null = null;

  selection.forEach((col, row) => {
    if (col < 0) {
      previous = null;
      return;
    }
    filled++;
    sum += puzzle.cells[row * puzzle.size + col];
    if (row === 0 && col !== puzzle.entryCol) illegalSteps.push(row);
    if (previous !== null && Math.abs(col - previous) > 1) illegalSteps.push(row);
    previous = col;
  });

  const lastFilledIndex = [...selection].reverse().findIndex((col) => col >= 0);
  const lastRow = lastFilledIndex === -1 ? -1 : selection.length - 1 - lastFilledIndex;
  if (lastRow === puzzle.size - 1 && selection[puzzle.size - 1] !== puzzle.exitCol) {
    illegalSteps.push(puzzle.size - 1);
  }

  return {
    solved: filled === puzzle.size && sum === puzzle.target && illegalSteps.length === 0,
    filled,
    sum,
    illegalSteps: [...new Set(illegalSteps)],
  };
}
