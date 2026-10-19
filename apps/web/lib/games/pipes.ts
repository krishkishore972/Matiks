/**
 * Pipes — `howToPlayV2.pipesHTP`, `buildPipesWinRoute`, `PIPES_COLORS`.
 *
 * Reference evidence: the hint copy names the two failure modes — an opening
 * pointing off the board or into a blocker, and an opening facing a neighbour
 * that does not open back — and the app exposes `buildPipesWinRoute`.
 *
 * Mechanic: rotate every tile until the whole grid is leak-free and connected.
 */
import { createRng } from "../rng";

/** Bit flags, clockwise from north. */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;

export type PipeShape = "cap" | "straight" | "elbow" | "tee" | "cross";

export interface PipeCell {
  shape: PipeShape;
  /** Openings at rotation 0. */
  base: number;
  /** Correct rotation, 0..3. */
  solution: number;
  /** Current rotation, 0..3. */
  rotation: number;
}

export interface PipesPuzzle {
  id: string;
  seed: string;
  size: number;
  cells: PipeCell[];
}

const BASE_OPENINGS: Record<PipeShape, number> = {
  cap: N,
  straight: N | S,
  elbow: N | E,
  tee: N | E | S,
  cross: N | E | S | W,
};

export function rotateMask(mask: number, rotation: number): number {
  const r = ((rotation % 4) + 4) % 4;
  let out = 0;
  if (mask & N) out |= [N, E, S, W][r];
  if (mask & E) out |= [E, S, W, N][r];
  if (mask & S) out |= [S, W, N, E][r];
  if (mask & W) out |= [W, N, E, S][r];
  return out;
}

export function openings(cell: PipeCell): number {
  return rotateMask(cell.base, cell.rotation);
}

function popcount(mask: number): number {
  let count = 0;
  let m = mask;
  while (m) {
    count += m & 1;
    m >>= 1;
  }
  return count;
}

function shapeForMask(mask: number): PipeShape {
  const count = popcount(mask);
  if (count === 4) return "cross";
  if (count === 3) return "tee";
  if (count === 1) return "cap";
  return mask === (N | S) || mask === (E | W) ? "straight" : "elbow";
}

function rotationFor(shape: PipeShape, mask: number): number {
  for (let r = 0; r < 4; r++) if (rotateMask(BASE_OPENINGS[shape], r) === mask) return r;
  return 0;
}

const OFFSETS: Array<{ flag: number; dRow: number; dCol: number; opposite: number }> = [
  { flag: N, dRow: -1, dCol: 0, opposite: S },
  { flag: E, dRow: 0, dCol: 1, opposite: W },
  { flag: S, dRow: 1, dCol: 0, opposite: N },
  { flag: W, dRow: 0, dCol: -1, opposite: E },
];

export function generatePipes(seed: string | number, sizeOverride?: number): PipesPuzzle {
  const rng = createRng(seed);
  const size = sizeOverride ?? (rng.next() < 0.5 ? 5 : 6);

  // Randomised spanning tree keeps every cell connected; extra edges add loops
  // (which is what produces tee and cross tiles).
  const edges = new Set<string>();
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

  const visited = new Set<number>([rng.int(size * size)]);
  const stack = [...visited];
  while (stack.length > 0) {
    const cell = stack[stack.length - 1];
    const row = Math.floor(cell / size);
    const col = cell % size;
    const candidates = OFFSETS.map((o) => ({
      cell: (row + o.dRow) * size + (col + o.dCol),
      valid: row + o.dRow >= 0 && row + o.dRow < size && col + o.dCol >= 0 && col + o.dCol < size,
    })).filter((c) => c.valid && !visited.has(c.cell));

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }
    const next = rng.pick(candidates).cell;
    edges.add(key(cell, next));
    visited.add(next);
    stack.push(next);
  }

  for (let cell = 0; cell < size * size; cell++) {
    for (const offset of [E, S]) {
      const o = OFFSETS.find((n) => n.flag === offset)!;
      const row = Math.floor(cell / size) + o.dRow;
      const col = (cell % size) + o.dCol;
      if (row < 0 || row >= size || col < 0 || col >= size) continue;
      const other = row * size + col;
      if (edges.has(key(cell, other))) continue;
      if (rng.next() < 0.2) edges.add(key(cell, other));
    }
  }

  const cells: PipeCell[] = [];
  for (let cell = 0; cell < size * size; cell++) {
    const row = Math.floor(cell / size);
    const col = cell % size;
    let mask = 0;
    for (const offset of OFFSETS) {
      const r = row + offset.dRow;
      const c = col + offset.dCol;
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      if (edges.has(key(cell, r * size + c))) mask |= offset.flag;
    }
    const shape = shapeForMask(mask);
    const solution = rotationFor(shape, mask);
    const offsetRotation = shape === "cross" || shape === "cap" ? 0 : 1 + rng.int(3);
    cells.push({
      shape,
      base: BASE_OPENINGS[shape],
      solution,
      rotation: shape === "cross" ? solution : (solution + offsetRotation) % 4,
    });
  }

  return { id: `pipes-${size}-${String(seed)}`, seed: String(seed), size, cells };
}

export interface PipesValidation {
  solved: boolean;
  leaks: number[];
  components: number;
  wrongRotations: number[];
}

export function validatePipes(puzzle: PipesPuzzle): PipesValidation {
  const { size, cells } = puzzle;
  const leaks = new Set<number>();

  for (let cell = 0; cell < cells.length; cell++) {
    const mask = openings(cells[cell]);
    const row = Math.floor(cell / size);
    const col = cell % size;
    for (const offset of OFFSETS) {
      if (!(mask & offset.flag)) continue;
      const r = row + offset.dRow;
      const c = col + offset.dCol;
      if (r < 0 || r >= size || c < 0 || c >= size) {
        leaks.add(cell);
        continue;
      }
      const other = r * size + c;
      if (!(openings(cells[other]) & offset.opposite)) leaks.add(cell);
    }
  }

  const seen = new Set<number>();
  let components = 0;
  for (let start = 0; start < cells.length; start++) {
    if (seen.has(start)) continue;
    components++;
    const queue = [start];
    seen.add(start);
    while (queue.length > 0) {
      const cell = queue.pop()!;
      const mask = openings(cells[cell]);
      const row = Math.floor(cell / size);
      const col = cell % size;
      for (const offset of OFFSETS) {
        if (!(mask & offset.flag)) continue;
        const r = row + offset.dRow;
        const c = col + offset.dCol;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const other = r * size + c;
        if (!(openings(cells[other]) & offset.opposite)) continue;
        if (!seen.has(other)) {
          seen.add(other);
          queue.push(other);
        }
      }
    }
  }

  const wrongRotations = cells
    .map((cell, index) => (cell.rotation === cell.solution ? -1 : index))
    .filter((index) => index >= 0);

  return {
    solved: leaks.size === 0 && components === 1 && wrongRotations.length === 0,
    leaks: [...leaks],
    components,
    wrongRotations,
  };
}

/** `buildPipesWinRoute` — the solved rotation for every tile. */
export function buildPipesWinRoute(puzzle: PipesPuzzle): number[] {
  return puzzle.cells.map((cell) => cell.solution);
}
