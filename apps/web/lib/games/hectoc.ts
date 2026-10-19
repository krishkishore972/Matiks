/**
 * Hectoc engine — `puzzle.title.hectoc`, `validateHectocSolution`.
 *
 * Reference evidence: "It's a fun logic puzzle that combines arithmetic with
 * Sudoku-like rules." The shipped puzzle string carries six digits and the app
 * exposes `validateHectocSolution` and a `HectocBackspaceButton`.
 *
 * Mechanic: using the six given digits **in order**, insert + − × ÷ and
 * parentheses so the expression equals 100. Validation uses exact rational
 * arithmetic (no floating point), so `12/(11+5)` style answers are judged
 * precisely — mirroring the app's worked accuracy example.
 */
import { createRng } from "../rng";
import type { Difficulty } from "../types";

export interface HectocPuzzle {
  id: string;
  seed: string;
  difficulty: Difficulty;
  digits: number[];
  target: number;
  /** One expression known to reach the target, used for hints and tests. */
  solution: string;
}

export const HECTOC_TARGET = 100;

interface Rational {
  n: number;
  d: number;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

function rat(n: number, d = 1): Rational {
  if (d === 0) throw new Error("division by zero");
  const sign = d < 0 ? -1 : 1;
  const g = gcd(n, d);
  return { n: (sign * n) / g, d: (sign * d) / g };
}

const add = (a: Rational, b: Rational) => rat(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Rational, b: Rational) => rat(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Rational, b: Rational) => rat(a.n * b.n, a.d * b.d);
const div = (a: Rational, b: Rational) => rat(a.n * b.d, a.d * b.n);
const isTarget = (a: Rational, target: number) => a.d !== 0 && a.n === target * a.d;

interface Candidate {
  value: Rational;
  expr: string;
}

const MAX_PER_SEGMENT = 300;

/**
 * All values reachable from a contiguous digit slice, with one witness
 * expression. Deduped by value and capped so generation stays fast.
 */
function reachable(digits: number[]): Candidate[] {
  const memo = new Map<string, Candidate[]>();

  const solve = (lo: number, hi: number): Candidate[] => {
    const key = `${lo}:${hi}`;
    const cached = memo.get(key);
    if (cached) return cached;

    const out: Candidate[] = [];
    if (hi - lo === 1) {
      out.push({ value: rat(digits[lo]), expr: String(digits[lo]) });
    } else {
      for (let split = lo + 1; split < hi; split++) {
        for (const a of solve(lo, split)) {
          for (const b of solve(split, hi)) {
            out.push({ value: add(a.value, b.value), expr: `(${a.expr}+${b.expr})` });
            out.push({ value: sub(a.value, b.value), expr: `(${a.expr}-${b.expr})` });
            out.push({ value: mul(a.value, b.value), expr: `(${a.expr}*${b.expr})` });
            if (b.value.n !== 0) {
              out.push({ value: div(a.value, b.value), expr: `(${a.expr}/${b.expr})` });
            }
          }
        }
      }
    }

    const deduped = new Map<string, Candidate>();
    for (const candidate of out) {
      const id = `${candidate.value.n}/${candidate.value.d}`;
      if (!deduped.has(id)) deduped.set(id, candidate);
      if (deduped.size >= MAX_PER_SEGMENT) break;
    }
    const list = [...deduped.values()];
    memo.set(key, list);
    return list;
  };

  return solve(0, digits.length);
}

function stripOuterParens(expr: string): string {
  let out = expr;
  const balanced = (s: string) => {
    let depth = 0;
    for (const ch of s) {
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth < 0) return false;
      }
    }
    return depth === 0;
  };
  while (out.startsWith("(") && out.endsWith(")") && balanced(out.slice(1, -1))) {
    out = out.slice(1, -1);
  }
  return out;
}

/** Does this digit string have any solution reaching the target? */
export function hectocSolvable(digits: number[], target = HECTOC_TARGET): string | null {
  const hit = reachable(digits).find((candidate) => isTarget(candidate.value, target));
  return hit ? stripOuterParens(hit.expr) : null;
}

export function generateHectoc(
  seed: string | number,
  difficulty: Difficulty = "easy",
): HectocPuzzle {
  const rng = createRng(seed);
  const maxAttempts = difficulty === "easy" ? 60 : 200;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const digits = Array.from({ length: 6 }, () => 1 + rng.int(9));
    const solution = hectocSolvable(digits);
    if (solution) {
      return {
        id: `hectoc-${difficulty}-${String(seed)}`,
        seed: String(seed),
        difficulty,
        digits,
        target: HECTOC_TARGET,
        solution,
      };
    }
  }
  const digits = [1, 2, 3, 4, 5, 6];
  return {
    id: `hectoc-${difficulty}-${String(seed)}`,
    seed: String(seed),
    difficulty,
    digits,
    target: HECTOC_TARGET,
    solution: hectocSolvable(digits) ?? "((1+2)*3+4+5+6)",
  };
}

/** Exact rational evaluator for player input: digits, + - * / ( ) and spaces. */
export function evaluateExpression(input: string): Rational {
  const tokens = input.match(/\d+|[+\-*/()]/g) ?? [];
  let index = 0;

  const peek = () => tokens[index];
  const eat = (expected?: string) => {
    const token = tokens[index];
    if (expected && token !== expected) throw new Error(`expected ${expected}`);
    index++;
    return token;
  };

  const parseFactor = (): Rational => {
    const token = peek();
    if (token === "(") {
      eat("(");
      const value = parseExpr();
      eat(")");
      return value;
    }
    if (token === "-") {
      eat("-");
      const value = parseFactor();
      return rat(-value.n, value.d);
    }
    if (token === undefined || !/^\d+$/.test(token)) throw new Error("bad expression");
    eat();
    return rat(Number(token));
  };

  const parseTerm = (): Rational => {
    let value = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = eat();
      const rhs = parseFactor();
      value = op === "*" ? mul(value, rhs) : div(value, rhs);
    }
    return value;
  };

  const parseExpr = (): Rational => {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = eat();
      const rhs = parseTerm();
      value = op === "+" ? add(value, rhs) : sub(value, rhs);
    }
    return value;
  };

  const result = parseExpr();
  if (index !== tokens.length) throw new Error("trailing input");
  return result;
}

export interface HectocVerdict {
  ok: boolean;
  reason?: "syntax" | "digits" | "wrong-value";
  value?: number;
}

/**
 * Validate a player answer: the digits must appear as single digits in the
 * puzzle's order, and the expression must evaluate exactly to the target.
 */
export function validateHectoc(puzzle: HectocPuzzle, input: string): HectocVerdict {
  const used = (input.match(/\d+/g) ?? []).join("").split("").map(Number);
  if (used.length !== puzzle.digits.length || used.some((d, i) => d !== puzzle.digits[i])) {
    return { ok: false, reason: "digits" };
  }

  let value: Rational;
  try {
    value = evaluateExpression(input);
  } catch {
    return { ok: false, reason: "syntax" };
  }

  if (isTarget(value, puzzle.target)) return { ok: true, value: puzzle.target };
  return {
    ok: false,
    reason: "wrong-value",
    value: value.d === 0 ? Number.NaN : value.n / value.d,
  };
}
