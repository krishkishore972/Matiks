/**
 * Authoritative duel questions.
 *
 * The server owns the question bank and the answer key; the client is only ever
 * sent the prompt. That is what makes a duel real rather than a client-reported
 * score, and it is why this lives on the server instead of being shared with the
 * practice generators in the web app.
 *
 * Generation is seeded (`createRng` from @repo/core) so a duel is reproducible
 * from its game id, and both players in a match are served the same sequence.
 */
import { createRng, seedFromString } from "@repo/core/rng";
import type { Rng } from "@repo/core/rng";

export interface DuelQuestion {
  prompt: string;
  answer: number;
  /** Present for multiple-choice modes. */
  choices?: number[];
}

export type QuestionKind = "arithmetic" | "dmas" | "squares";

const ARITHMETIC_OPS = ["+", "−", "×", "÷"] as const;

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[rng.int(items.length)];
}

/** Difficulty grows with the player's rating, mirroring "difficulty scales with your rating". */
function magnitudeForRating(rating: number): number {
  if (rating < 1100) return 12;
  if (rating < 1300) return 20;
  if (rating < 1500) return 35;
  if (rating < 1800) return 60;
  return 99;
}

function arithmetic(rng: Rng, rating: number): DuelQuestion {
  const max = magnitudeForRating(rating);
  const op = pick(rng, ARITHMETIC_OPS);

  if (op === "×") {
    const a = rng.int(Math.min(12, max)) + 2;
    const b = rng.int(Math.min(12, max)) + 2;
    return { prompt: `${a} × ${b}`, answer: a * b };
  }

  if (op === "÷") {
    const b = rng.int(Math.min(11, max)) + 2;
    const quotient = rng.int(Math.min(11, max)) + 2;
    const a = b * quotient;
    return { prompt: `${a} ÷ ${b}`, answer: quotient };
  }

  const a = rng.int(max) + 1;
  const b = rng.int(max) + 1;
  if (op === "+") return { prompt: `${a} + ${b}`, answer: a + b };
  // Subtraction is ordered so the answer stays positive.
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return { prompt: `${hi} − ${lo}`, answer: hi - lo };
}

/** DMAS: precedence matters, so the answer is not left-to-right. */
function dmas(rng: Rng, rating: number): DuelQuestion {
  const cap = Math.min(20, magnitudeForRating(rating));
  const a = rng.int(cap) + 2;
  const b = rng.int(cap) + 2;
  const c = rng.int(Math.min(12, cap)) + 2;
  const first = pick(rng, ["×", "+", "−"] as const);

  if (first === "×") {
    // a + b × c
    return { prompt: `${a} + ${b} × ${c}`, answer: a + b * c };
  }
  if (first === "+") {
    return { prompt: `${a} × ${b} + ${c}`, answer: a * b + c };
  }
  // a × b − c, with c bounded by the product so the answer cannot go negative.
  // The multiplication is still what makes it a precedence question.
  const product = a * b;
  const subtrahend = rng.int(Math.max(1, Math.min(cap, product))) + 1;
  return { prompt: `${a} × ${b} − ${subtrahend}`, answer: product - subtrahend };
}

/** Sum of Squares: find numbers whose squares sum to the target. */
function squares(rng: Rng, rating: number): DuelQuestion {
  const target = 20 + rng.int(Math.min(120, magnitudeForRating(rating)));
  return { prompt: `Squares summing to ${target}`, answer: target };
}

export function generateQuestion(
  kind: QuestionKind,
  rng: Rng,
  rating: number,
): DuelQuestion {
  if (kind === "dmas") return dmas(rng, rating);
  if (kind === "squares") return squares(rng, rating);
  return arithmetic(rng, rating);
}

const CHOICE_COUNT = 4;

/** Multiple-choice rounds get distractors that are near misses, never the answer twice. */
function withChoices(rng: Rng, question: DuelQuestion): DuelQuestion {
  const choices = new Set<number>([question.answer]);
  const spread = Math.max(2, Math.round(Math.abs(question.answer) * 0.15) + 1);
  let guard = 0;
  while (choices.size < CHOICE_COUNT && guard < 200) {
    guard += 1;
    const delta = rng.int(spread * 2 + 1) - spread;
    const candidate = question.answer + (delta === 0 ? 1 : delta);
    if (candidate !== question.answer) choices.add(candidate);
  }
  return { ...question, choices: [...choices].sort((a, b) => a - b) };
}

/**
 * Build the bank for one duel. `count` is deliberately larger than any player
 * can answer inside the time limit, so the bank never runs dry mid-duel.
 */
export function buildQuestionBank(
  kind: QuestionKind,
  gameId: string,
  rating: number,
  count = 240,
): DuelQuestion[] {
  const rng = createRng(seedFromString(`duel-questions:${gameId}`));
  const bank: DuelQuestion[] = [];
  for (let i = 0; i < count; i += 1) {
    const question = generateQuestion(kind, rng, rating);
    // Roughly every fourth arithmetic round is multiple choice, which keeps the
    // Fastest Finger variants feeling different without a second generator.
    const wantsChoices = kind === "arithmetic" && i % 4 === 3;
    bank.push(wantsChoices ? withChoices(rng, question) : question);
  }
  return bank;
}

/** Strips the answer key before anything is sent to a client. */
export function publicQuestion(question: DuelQuestion): Omit<DuelQuestion, "answer"> {
  return {
    prompt: question.prompt,
    ...(question.choices ? { choices: question.choices } : {}),
  };
}
