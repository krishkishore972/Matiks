/**
 * Reflex / duel engines.
 *
 * Reference evidence (docs/reference/gameplay-notes.md):
 *  - Sprint: "In a 60-second sprint you play boards back to back. Your first
 *    board is board position 1, your second is position 2, and so on."
 *  - Fastest Finger: "PLAY 1-MIN FASTEST FINGER DUEL"; "race to solve the most
 *    in 1 minute".
 *  - Flash Anzan: "Flash Anzan has 3 rounds of fast mental addition."
 *  - Mind Snap: presets are written `<grid>G(<squares>S)` (25G(9S) = 5×5 grid,
 *    9 lit squares). Scoring: "Each correct tap +1, each wrong −1. You get only
 *    as many taps as highlighted tiles."
 *  - Pin Ball Recall: "Track the ball through the bumpers, then recall its
 *    exit." Scoring: "an exact exit is 1, an adjacent tap 0.5."
 *  - Ability Duels / Sum of Squares: "Numbers when squared and added give the
 *    target number", "can have multiple solutions".
 *  - DMAS: "Solve DMAS problems at the top and enter your answer below.
 *    Difficulty scales with your rating."
 */
import type { Rng } from "../rng";

export interface ArithmeticQuestion {
  prompt: string;
  answer: number;
  choices?: number[];
}

const OPS = ["+", "-", "*", "/"] as const;

const LEVEL_MAX = [9, 12, 20, 50, 99];

function levelMax(level: number): number {
  return LEVEL_MAX[Math.min(LEVEL_MAX.length - 1, Math.max(0, level - 1))];
}

/** Mixed arithmetic; difficulty scales with `level` (1..5). */
export function arithmeticQuestion(rng: Rng, level = 1): ArithmeticQuestion {
  const max = levelMax(level);
  const op = rng.pick(OPS);
  let a = 1 + rng.int(max);
  let b = 1 + rng.int(max);

  switch (op) {
    case "+":
      return { prompt: `${a} + ${b}`, answer: a + b };
    case "-": {
      if (b > a) [a, b] = [b, a];
      return { prompt: `${a} − ${b}`, answer: a - b };
    }
    case "*": {
      const clampedA = 1 + rng.int(Math.min(max, 12));
      const clampedB = 1 + rng.int(Math.min(max, 12));
      return { prompt: `${clampedA} × ${clampedB}`, answer: clampedA * clampedB };
    }
    case "/": {
      const answer = 2 + rng.int(Math.max(2, Math.floor(max / 2)));
      const divisor = 2 + rng.int(9);
      return { prompt: `${answer * divisor} ÷ ${divisor}`, answer };
    }
  }
}

/** Evaluate an expression with BODMAS precedence; null when not a clean integer. */
export function evaluateDmas(expression: string): number | null {
  const tokens = expression.match(/\d+|[+\-*/]/g) ?? [];
  let index = 0;
  const peek = () => tokens[index];

  const factor = (): number | null => {
    const token = peek();
    if (token === undefined || !/^\d+$/.test(token)) return null;
    index++;
    return Number(token);
  };
  const term = (): number | null => {
    let value = factor();
    if (value === null) return null;
    while (peek() === "*" || peek() === "/") {
      const op = peek();
      index++;
      const rhs = factor();
      if (rhs === null) return null;
      if (op === "*") value *= rhs;
      else {
        if (rhs === 0 || value % rhs !== 0) return null;
        value /= rhs;
      }
    }
    return value;
  };
  const expr = (): number | null => {
    let value = term();
    if (value === null) return null;
    while (peek() === "+" || peek() === "-") {
      const op = peek();
      index++;
      const rhs = term();
      if (rhs === null) return null;
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  };

  const result = expr();
  if (result === null || index !== tokens.length || !Number.isInteger(result) || result < 0) {
    return null;
  }
  return result;
}

/** DMAS question with a guaranteed clean integer answer under BODMAS. */
export function dmasQuestion(rng: Rng, level = 1): ArithmeticQuestion {
  const max = levelMax(level);
  for (let attempt = 0; attempt < 200; attempt++) {
    const a = 1 + rng.int(max);
    const b = 1 + rng.int(max);
    const c = 1 + rng.int(max);
    const first = rng.pick(["+", "-", "*"] as const);
    const second = rng.pick(["+", "-", "*"] as const);
    const prompt = `${a} ${first} ${b} ${second} ${c}`;
    const answer = evaluateDmas(prompt);
    if (answer !== null && answer <= 9999) return { prompt, answer };
  }
  return { prompt: "2 + 3 * 4", answer: 14 };
}

/** Plausible wrong answers around the correct one. */
export function answerChoices(rng: Rng, answer: number, count = 4): number[] {
  const choices = new Set<number>([answer]);
  let guard = 0;
  while (choices.size < count && guard++ < 200) {
    const spread = Math.max(2, Math.round(Math.abs(answer) * 0.25) + 3);
    const candidate = answer + rng.int(spread * 2 + 1) - spread;
    if (candidate !== answer && candidate >= 0) choices.add(candidate);
  }
  return rng.shuffle([...choices]);
}

export interface FlashAnzanRound {
  numbers: number[];
  answer: number;
  intervalMs: number;
}

/** One Flash Anzan round: numbers appear in sequence, the player sums them. */
export function flashAnzanRound(
  rng: Rng,
  options: { count?: number; digits?: number; intervalMs?: number; subtract?: boolean } = {},
): FlashAnzanRound {
  const count = options.count ?? 5;
  const digits = options.digits ?? 2;
  const intervalMs = options.intervalMs ?? 800;
  const subtract = options.subtract ?? false;
  const max = 10 ** digits - 1;
  const min = digits === 1 ? 1 : 10 ** (digits - 1);

  let total = 0;
  const numbers: number[] = [];
  for (let i = 0; i < count; i++) {
    let value = min + rng.int(max - min + 1);
    if (subtract && i > 0 && rng.next() < 0.35) value = -value;
    numbers.push(value);
    total += value;
  }
  return { numbers, answer: total, intervalMs };
}

/** Mind Snap preset id, e.g. `25G(9S)`, exactly as the reference formats it. */
export function mindSnapPresetId(size: number, squares: number): string {
  return `${size * size}G(${squares}S)`;
}

export interface MindSnapBoard {
  size: number;
  squares: number;
  highlighted: number[];
  presetId: string;
}

export function mindSnapBoard(rng: Rng, size = 5, squares = 9): MindSnapBoard {
  const total = size * size;
  const count = Math.min(squares, total);
  const highlighted = rng.shuffle(Array.from({ length: total }, (_, i) => i)).slice(0, count);
  return { size, squares: count, highlighted, presetId: mindSnapPresetId(size, count) };
}

export interface MindSnapScore {
  points: number;
  hits: number;
  misses: number;
  extraTaps: number;
}

/** "+1 per correct tap, −1 per wrong tap, one tap allowed per highlighted tile." */
export function mindSnapScore(taps: number[], highlighted: number[]): MindSnapScore {
  const targets = new Set(highlighted);
  const allowed = highlighted.length;
  let points = 0;
  let hits = 0;
  let misses = 0;
  let extraTaps = 0;

  taps.forEach((tap, index) => {
    if (index >= allowed) {
      extraTaps++;
      points -= 1;
      return;
    }
    if (targets.has(tap)) {
      hits++;
      points += 1;
    } else {
      misses++;
      points -= 1;
    }
  });

  return { points, hits, misses, extraTaps };
}

export interface PinBallBoard {
  width: number;
  height: number;
  startColumn: number;
  /** Bumper cells (row-major). */
  bumpers: number[];
  exitColumn: number;
  /** Column at each row, for the reveal animation. */
  columns: number[];
}

/**
 * The ball starts at the top and drops one row per step; bumpers deflect it one
 * column left or right. The player memorises the board, the bumpers hide, and
 * they recall the exit column.
 */
export function pinBallBoard(rng: Rng, width = 5, height = 5, bumperCount = 6): PinBallBoard {
  const bumpers = rng
    .shuffle(Array.from({ length: width * height }, (_, i) => i))
    .slice(0, bumperCount);
  const bumperSet = new Set(bumpers);
  const startColumn = rng.int(width);
  const columns = [startColumn];
  let column = startColumn;

  for (let row = 1; row < height; row++) {
    const cell = row * width + column;
    if (bumperSet.has(cell)) {
      const options = [column - 1, column + 1].filter((c) => c >= 0 && c < width);
      if (options.length > 0) column = rng.pick(options);
    }
    columns.push(column);
  }

  return { width, height, startColumn, bumpers, exitColumn: column, columns };
}

/** Exact exit = 1 point, adjacent column = 0.5, otherwise 0. */
export function pinBallScore(guess: number, exitColumn: number): number {
  if (guess === exitColumn) return 1;
  if (Math.abs(guess - exitColumn) === 1) return 0.5;
  return 0;
}

export interface SumOfSquaresPuzzle {
  target: number;
  terms: number;
  /** Up to four known solutions. */
  solutions: number[][];
}

function squaresDecomposition(target: number, terms: number, limit = 4): number[][] {
  const out: number[][] = [];
  const recurse = (remaining: number, left: number, current: number[]) => {
    if (out.length >= limit) return;
    if (left === 1) {
      const root = Math.round(Math.sqrt(remaining));
      for (const candidate of [root - 1, root, root + 1]) {
        if (candidate > 0 && candidate * candidate === remaining) out.push([...current, candidate]);
      }
      return;
    }
    const max = Math.floor(Math.sqrt(remaining));
    for (let value = max; value >= 1; value--) {
      recurse(remaining - value * value, left - 1, [...current, value]);
      if (out.length >= limit) return;
    }
  };
  recurse(target, terms, []);
  return out;
}

export function sumOfSquares(rng: Rng, terms = 3, maxValue = 12): SumOfSquaresPuzzle {
  for (let attempt = 0; attempt < 400; attempt++) {
    const values = Array.from({ length: terms }, () => 1 + rng.int(maxValue));
    const target = values.reduce((acc, v) => acc + v * v, 0);
    const solutions = squaresDecomposition(target, terms);
    if (solutions.length >= 1) return { target, terms, solutions };
  }
  return { target: 50, terms, solutions: [[3, 4, 5]] };
}

/** "Use space to separate multiple numbers" — validate the squares sum to target. */
export function validateSumOfSquares(
  puzzle: SumOfSquaresPuzzle,
  values: number[],
): { ok: boolean; sum: number; over: boolean } {
  const sum = values.reduce((acc, v) => acc + v * v, 0);
  return { ok: values.length === puzzle.terms && sum === puzzle.target, sum, over: sum > puzzle.target };
}
