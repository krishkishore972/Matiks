/**
 * Scoring, quality bands, shapes and rating maths.
 *
 * Evidence (see docs/reference/gameplay-notes.md):
 *  - Minimum score for a play to count: Mind Snap 60, Flash Anzan 90, Sprint 10,
 *    Ability (Sum of Squares) 8, Fastest Finger 5, Cross Math 4, Math Maze 4,
 *    KenKen 2, Sudoku 2.
 *  - Accuracy counts every wrong attempt, backspace, clear and retry.
 *  - Solve-quality bands: ZAP, FLOW, GRIND, CHOKE, FREEZE — "Wrong answers sit
 *    outside this scale." Numeric cut-offs are not in the artifact, so the
 *    thresholds below are documented inference, not recovered constants.
 *  - Blitz shapes: Dominator, Comeback, Clutch, Almost, Close Call (winning) and
 *    Slip up, Blunder, Crushed (losing), decided by how the lead moved across the
 *    60 seconds (three 20-second windows).
 *  - "Rating" is Elo-style.
 */
import type { BlitzShape, GameId, GameResult, QualityBand } from "./types";

export const MIN_SCORE: Record<GameId, number> = {
  mindsnap: 60,
  flashanzan: 90,
  sprint: 10,
  sumofsquares: 8,
  fastestfinger: 5,
  crossmath: 4,
  mathmaze: 4,
  kenken: 2,
  sudoku: 2,
  // Not listed in the quest-rules string; treated as 1 so any finish counts.
  hectoc: 2,
  queens: 2,
  tango: 2,
  zip: 2,
  pipes: 2,
  wend: 2,
  pinballrecall: 5,
  dmas: 4,
};

/** Difficulty weighting for puzzle scoring. */
const DIFFICULTY_WEIGHT = {
  easy: 1,
  medium: 1.35,
  hard: 1.75,
  expert: 2.2,
} as const;

/** Expected solve time per puzzle difficulty, used for speed scoring. */
const BASE_MS = {
  easy: 90_000,
  medium: 150_000,
  hard: 240_000,
  expert: 360_000,
} as const;

export interface ScoreInput {
  difficulty: keyof typeof DIFFICULTY_WEIGHT;
  solved: boolean;
  /** 0..1 */
  accuracy: number;
  durationMs: number;
  /** Optional explicit point value (reflex games score their own points). */
  points?: number;
}

/**
 * Puzzle score: a difficulty-weighted 1000-point base, scaled by accuracy and
 * speed, with a hard floor of 0 for unsolved boards.
 */
export function scorePuzzle(input: ScoreInput): number {
  const { difficulty, solved, accuracy, durationMs, points } = input;
  if (points !== undefined) {
    return Math.max(0, Math.round(points * (solved ? 1 : 0.25)));
  }
  if (!solved) return 0;
  const weight = DIFFICULTY_WEIGHT[difficulty];
  const speedRatio = Math.min(2, BASE_MS[difficulty] / Math.max(1000, durationMs));
  const base = 1000 * weight;
  const accuracyFactor = 0.5 + 0.5 * clamp01(accuracy);
  const speedFactor = 0.7 + 0.3 * Math.min(1, speedRatio);
  return Math.round(base * accuracyFactor * speedFactor);
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Accuracy from attempt counters. Every wrong tap, backspace, clear and retry
 * counts (the reference app's redefined accuracy), so this is
 * correct / (correct + mistakes).
 */
export function accuracyFrom(correct: number, mistakes: number): number {
  const total = correct + mistakes;
  if (total <= 0) return 1;
  return clamp01(correct / total);
}

/**
 * Quality band for a correct solve. Ratios are relative to the expected solve
 * time for the board; thresholds are inference (documented above).
 */
export function qualityBand(solveMs: number, expectedMs: number): QualityBand {
  const ratio = solveMs / Math.max(1, expectedMs);
  if (ratio <= 0.5) return "ZAP";
  if (ratio <= 0.9) return "FLOW";
  if (ratio <= 1.4) return "GRIND";
  if (ratio <= 2.2) return "CHOKE";
  return "FREEZE";
}

export const QUALITY_BAND_LABEL: Record<QualityBand, string> = {
  ZAP: "Lightning fast — well inside the expected pace.",
  FLOW: "At the expected pace for this preset. Solid, not spectacular.",
  GRIND: "Slower than expected. Accurate, but the clock cost you.",
  CHOKE: "Hard, low accuracy. This is where your rating leaks.",
  FREEZE: "Way over time. Practise this preset before it costs you again.",
};

export interface BlitzWindow {
  /** Score the player banked in this 20-second window. */
  player: number;
  /** Score the opponent banked in this 20-second window. */
  opponent: number;
}

/**
 * Blitz shape from the lead across the three 20-second windows.
 * "Every Blitz duel ends with one of 8 shapes — 5 winning, 3 losing — based on
 * how the lead moved across the 60 seconds."
 */
export function blitzShape(windows: BlitzWindow[]): {
  shape: BlitzShape;
  won: boolean;
  leadAtEnd: number;
} {
  const lead = windows.map((w) => w.player - w.opponent);
  const leadAtEnd = lead.reduce((a, b) => a + b, 0);
  const first = lead[0] ?? 0;
  const last = lead[lead.length - 1] ?? 0;
  const peak = Math.max(...lead, 0);
  const won = leadAtEnd > 0;

  if (won) {
    if (first > 0 && lead.every((l) => l >= 0)) return { shape: "Dominator", won, leadAtEnd };
    if (first < 0 && last > 0) return { shape: "Comeback", won, leadAtEnd };
    if (leadAtEnd <= 2 && peak > 6) return { shape: "Almost", won, leadAtEnd };
    if (last > 0 && windows[0].player <= windows[0].opponent) return { shape: "Clutch", won, leadAtEnd };
    return { shape: "Close Call", won, leadAtEnd };
  }
  if (first > 0 && last < 0) return { shape: "Slip up", won, leadAtEnd };
  if (Math.abs(leadAtEnd) >= 10) return { shape: "Crushed", won, leadAtEnd };
  return { shape: "Blunder", won, leadAtEnd };
}

export const BLITZ_SHAPE_NOTE: Record<BlitzShape, string> = {
  Dominator: "Fast start, never let go.",
  Comeback: "You were behind and took it back.",
  Clutch: "You had the lead when it mattered.",
  Almost: "A near miss with a big peak lead.",
  "Close Call": "Decided by a couple of points.",
  "Slip up": "You led early and lost it.",
  Blunder: "Points left on the board decided this.",
  Crushed: "A one-sided set.",
};

/**
 * Elo-style rating update. K shrinks as games accumulate so a long history is
 * more stable, mirroring the reference app's established-player behaviour.
 */
export function ratingDelta(
  rating: number,
  opponentRating: number,
  won: boolean,
  games: number,
): number {
  const k = Math.max(12, 40 - Math.min(24, games * 0.6));
  const expected = 1 / (1 + 10 ** ((opponentRating - rating) / 400));
  const actual = won ? 1 : 0;
  return Math.round(k * (actual - expected));
}

/** XP is score-derived with a completion bonus, boosted when an XP booster runs. */
export function xpFor(result: GameResult, multiplier = 1): number {
  const base = Math.round(result.score / 10);
  const bonus = result.solved ? 25 : 0;
  return Math.round((base + bonus) * multiplier);
}

/** True when a play meets the minimum-score rule for quest/streak progress. */
export function countsForProgress(result: GameResult): boolean {
  const min = MIN_SCORE[result.gameId] ?? 1;
  return result.score >= min;
}
