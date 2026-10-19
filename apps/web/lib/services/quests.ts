/**
 * Quests.
 *
 * The reference artifact exposes a Quests tab and a rules string that gates
 * progress on a *minimum score per play* ("Mind Snap 60, Flash Anzan 90, Sprint
 * 10, ...") plus the three streak triggers. The exact quest list is not present
 * in the extracted strings, so the objectives below are a documented, minimal
 * recreation built on the evidenced counters rather than a fabrication of
 * Matiks' own copy.
 */
import type { GameResult } from "../types";
import { countsForProgress } from "../scoring";

export type QuestMetric =
  | "totalGames"
  | "duels"
  | "puzzles"
  | "dailyPuzzles"
  | "perfectRuns";

export interface QuestReward {
  pies?: number;
  xp?: number;
}

export interface Quest {
  id: string;
  title: string;
  metric: QuestMetric;
  target: number;
  reward: QuestReward;
}

export type QuestCounters = Record<QuestMetric, number>;

export const QUESTS: Quest[] = [
  {
    id: "play-3",
    title: "Warm up: score above the minimum in 3 games",
    metric: "totalGames",
    target: 3,
    reward: { pies: 25, xp: 40 },
  },
  {
    id: "two-duels",
    title: "Play 2 duels",
    metric: "duels",
    target: 2,
    reward: { pies: 40, xp: 60 },
  },
  {
    id: "daily-five",
    title: "Finish all five Daily Challenge puzzles",
    metric: "dailyPuzzles",
    target: 5,
    reward: { pies: 120, xp: 150 },
  },
  {
    id: "infinite-two",
    title: "Solve 2 infinite puzzles",
    metric: "puzzles",
    target: 2,
    reward: { pies: 30, xp: 50 },
  },
  {
    id: "perfect-one",
    title: "Finish a board with no mistakes",
    metric: "perfectRuns",
    target: 1,
    reward: { pies: 60, xp: 90 },
  },
];

export interface QuestProgress {
  quest: Quest;
  value: number;
  complete: boolean;
  claimed: boolean;
}

export function emptyCounters(): QuestCounters {
  return { totalGames: 0, duels: 0, puzzles: 0, dailyPuzzles: 0, perfectRuns: 0 };
}

export const DUEL_METRIC_GAMES = new Set([
  "sprint",
  "fastestfinger",
  "dmas",
  "mindsnap",
  "flashanzan",
  "pinballrecall",
  "sumofsquares",
]);

export const INFINITE_METRIC_GAMES = new Set(["queens", "tango", "zip", "pipes", "wend"]);

/** Update counters from one finished play, honouring the minimum-score rule. */
export function applyResultToCounters(
  counters: QuestCounters,
  result: GameResult,
  isDaily: boolean,
): QuestCounters {
  if (!countsForProgress(result)) return counters;
  const next: QuestCounters = {
    totalGames: counters.totalGames + 1,
    duels: counters.duels + (DUEL_METRIC_GAMES.has(result.gameId) ? 1 : 0),
    puzzles: counters.puzzles + (INFINITE_METRIC_GAMES.has(result.gameId) ? 1 : 0),
    dailyPuzzles: counters.dailyPuzzles + (isDaily ? 1 : 0),
    perfectRuns: counters.perfectRuns + (result.accuracy >= 1 && result.solved ? 1 : 0),
  };
  return next;
}

export function evaluateQuests(counters: QuestCounters, claimed: string[]): QuestProgress[] {
  return QUESTS.map((quest) => {
    const value = counters[quest.metric] ?? 0;
    return {
      quest,
      value: Math.min(value, quest.target),
      complete: value >= quest.target,
      claimed: claimed.includes(quest.id),
    };
  });
}
