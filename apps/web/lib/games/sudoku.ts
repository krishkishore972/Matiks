/**
 * Sudoku engine — `puzzle.title.sudoku`, `nets.family.puzzleSudoku`.
 *
 * Reference evidence: "Fill in the numbers 1 to 6 so that no number repeats in
 * any row, any column, or any box." / "For an N×N grid (like 4x4), you'll use
 * the numbers 1 to N." Presets are size x difficulty and the difficulty band is
 * derived from how many cells are left blank (`sudokuBandForBlanks`).
 *
 * Boards are generated from a seed and only kept when the dug grid has exactly
 * one solution.
 */
import { createRng, type Rng } from "../rng";
import type { Difficulty } from "../types";

export const SUDOKU_SIZE = 9;
export const SUDOKU_CELLS = SUDOKU_SIZE * SUDOKU_SIZE;
const BOX = 3;

/** 0 means empty. */
export type SudokuGrid = number[];

export interface SudokuPuzzle {
  id: string;
  seed: string;
  difficulty: Difficulty;
  givens: SudokuGrid;
  solution: SudokuGrid;
  blanks: number;
}

export const SUDOKU_BLANKS: Record<Difficulty, number> = {
  easy: 40,
  medium: 46,
  hard: 52,
  expert: 56,
};

function isSafe(grid: SudokuGrid, index: number, value: number): boolean {
  const row = Math.floor(index / SUDOKU_SIZE);
  const col = index % SUDOKU_SIZE;
  for (let i = 0; i < SUDOKU_SIZE; i++) {
    if (grid[row * SUDOKU_SIZE + i] === value) return false;
    if (grid[i * SUDOKU_SIZE + col] === value) return false;
  }
  const boxRow = Math.floor(row / BOX) * BOX;
  const boxCol = Math.floor(col / BOX) * BOX;
  for (let r = 0; r < BOX; r++) {
    for (let c = 0; c < BOX; c++) {
      if (grid[(boxRow + r) * SUDOKU_SIZE + boxCol + c] === value) return false;
    }
  }
  return true;
}

function fillGrid(grid: SudokuGrid, rng: Rng, start = 0): boolean {
  let index = start;
  while (index < SUDOKU_CELLS && grid[index] !== 0) index++;
  if (index >= SUDOKU_CELLS) return true;
  for (const value of rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (isSafe(grid, index, value)) {
      grid[index] = value;
      if (fillGrid(grid, rng, index + 1)) return true;
      grid[index] = 0;
    }
  }
  return false;
}

/** Count solutions, stopping at `limit`. */
export function countSudokuSolutions(grid: SudokuGrid, limit = 2): number {
  const work = [...grid];
  let found = 0;
  const recurse = (): void => {
    if (found >= limit) return;
    let index = -1;
    for (let i = 0; i < SUDOKU_CELLS; i++) {
      if (work[i] === 0) {
        index = i;
        break;
      }
    }
    if (index === -1) {
      found++;
      return;
    }
    for (let value = 1; value <= SUDOKU_SIZE; value++) {
      if (isSafe(work, index, value)) {
        work[index] = value;
        recurse();
        work[index] = 0;
        if (found >= limit) return;
      }
    }
  };
  recurse();
  return found;
}

export function solveSudoku(grid: SudokuGrid): SudokuGrid | null {
  const work = [...grid];
  const recurse = (): boolean => {
    let index = -1;
    for (let i = 0; i < SUDOKU_CELLS; i++) {
      if (work[i] === 0) {
        index = i;
        break;
      }
    }
    if (index === -1) return true;
    for (let value = 1; value <= SUDOKU_SIZE; value++) {
      if (isSafe(work, index, value)) {
        work[index] = value;
        if (recurse()) return true;
        work[index] = 0;
      }
    }
    return false;
  };
  return recurse() ? work : null;
}

export function generateSudoku(
  seed: string | number,
  difficulty: Difficulty = "easy",
): SudokuPuzzle {
  const rng = createRng(seed);
  const solution = new Array<number>(SUDOKU_CELLS).fill(0);
  fillGrid(solution, rng);

  const givens = [...solution];
  const target = SUDOKU_BLANKS[difficulty];
  const order = rng.shuffle(Array.from({ length: SUDOKU_CELLS }, (_, i) => i));

  let blanks = 0;
  for (const index of order) {
    if (blanks >= target) break;
    const keep = givens[index];
    givens[index] = 0;
    if (countSudokuSolutions(givens, 2) !== 1) givens[index] = keep;
    else blanks++;
  }

  return {
    id: `sudoku-${difficulty}-${String(seed)}`,
    seed: String(seed),
    difficulty,
    givens,
    solution,
    blanks,
  };
}

export interface SudokuValidation {
  solved: boolean;
  conflicts: number[];
  mistakes: number[];
  filled: number;
  remaining: number;
}

export function validateSudoku(grid: SudokuGrid, solution: SudokuGrid): SudokuValidation {
  const conflicts = new Set<number>();
  const mistakes: number[] = [];
  let filled = 0;

  for (let i = 0; i < SUDOKU_CELLS; i++) {
    const value = grid[i];
    if (!value) continue;
    filled++;
    if (value !== solution[i]) mistakes.push(i);
    const row = Math.floor(i / SUDOKU_SIZE);
    const col = i % SUDOKU_SIZE;
    for (let c = 0; c < SUDOKU_SIZE; c++) {
      const other = row * SUDOKU_SIZE + c;
      if (other !== i && grid[other] === value) {
        conflicts.add(i);
        conflicts.add(other);
      }
    }
    for (let r = 0; r < SUDOKU_SIZE; r++) {
      const other = r * SUDOKU_SIZE + col;
      if (other !== i && grid[other] === value) {
        conflicts.add(i);
        conflicts.add(other);
      }
    }
    const boxRow = Math.floor(row / BOX) * BOX;
    const boxCol = Math.floor(col / BOX) * BOX;
    for (let r = 0; r < BOX; r++) {
      for (let c = 0; c < BOX; c++) {
        const other = (boxRow + r) * SUDOKU_SIZE + boxCol + c;
        if (other !== i && grid[other] === value) {
          conflicts.add(i);
          conflicts.add(other);
        }
      }
    }
  }

  return {
    solved: grid.every((value, index) => value === solution[index]),
    conflicts: [...conflicts],
    mistakes,
    filled,
    remaining: SUDOKU_CELLS - filled,
  };
}
