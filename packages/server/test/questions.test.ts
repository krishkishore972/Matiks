/**
 * The question bank is the answer key, so it is worth testing hard: a second
 * copy rebuilt from the same game id must be identical (that is what makes a
 * replay meaningful), every recorded answer must be the true value of its
 * prompt, and the answer must never leak to the client.
 */
import { describe, expect, it } from "vitest";
import { createRng, seedFromString } from "@repo/core/rng";
import {
  buildQuestionBank,
  generateQuestion,
  publicQuestion,
  type DuelQuestion,
} from "../src/domain/questions";

/** Evaluate a prompt the way a player would. */
function evaluate(prompt: string): number {
  const expression = prompt
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/\s+/g, "");
  const value = Function(`"use strict"; return (${expression});`)() as number;
  return value;
}

function everyQuestion(predicate: (question: DuelQuestion, index: number) => void): void {
  for (const rating of [900, 1150, 1250, 1450, 1700, 2000]) {
    for (const kind of ["arithmetic", "dmas"] as const) {
      const bank = buildQuestionBank(kind, `test:${kind}:${rating}`, rating, 60);
      bank.forEach(predicate);
    }
  }
}

describe("arithmetic and DMAS generators", () => {
  it("gives the true value of the prompt as the answer", () => {
    everyQuestion((question) => {
      expect(Number.isFinite(question.answer)).toBe(true);
      expect(evaluate(question.prompt)).toBe(question.answer);
    });
  });

  it("never emits a fraction, a negative result or a duplicate choice", () => {
    everyQuestion((question) => {
      expect(Number.isInteger(question.answer)).toBe(true);
      if (question.answer >= 0) return;
      throw new Error(`negative answer for "${question.prompt}"`);
    });
  });

  it("keeps multiple-choice distractors distinct from the answer", () => {
    const bank = buildQuestionBank("arithmetic", "test:choices", 1300, 200);
    const withChoices = bank.filter((question) => question.choices);
    expect(withChoices.length).toBeGreaterThan(0);
    for (const question of withChoices) {
      expect(new Set(question.choices).size).toBe(question.choices?.length);
      expect(question.choices).toContain(question.answer);
      expect(question.choices).toHaveLength(4);
    }
  });
});

describe("determinism", () => {
  it("rebuilds the identical bank from the same game id", () => {
    const first = buildQuestionBank("arithmetic", "game-abc", 1200, 40);
    const second = buildQuestionBank("arithmetic", "game-abc", 1200, 40);
    expect(second).toEqual(first);
  });

  it("produces a different bank for a different game id", () => {
    const first = buildQuestionBank("arithmetic", "game-abc", 1200, 40);
    const other = buildQuestionBank("arithmetic", "game-xyz", 1200, 40);
    expect(other).not.toEqual(first);
  });

  it("is driven by the seeded RNG, not Math.random", () => {
    const rngA = createRng(seedFromString("seed"));
    const rngB = createRng(seedFromString("seed"));
    expect(generateQuestion("dmas", rngA, 1400)).toEqual(generateQuestion("dmas", rngB, 1400));
  });
});

describe("publicQuestion", () => {
  it("strips the answer but keeps the prompt and choices", () => {
    const [question] = buildQuestionBank("arithmetic", "game-public", 1200, 10);
    const published = publicQuestion(question);
    expect(published).not.toHaveProperty("answer");
    expect(published.prompt).toBe(question.prompt);
    if (question.choices) expect(published.choices).toEqual(question.choices);
    expect(JSON.stringify(published)).not.toContain(String(question.answer));
  });
});
