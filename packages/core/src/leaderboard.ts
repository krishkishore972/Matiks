/**
 * Leaderboard taxonomy, shared so the client and server rank the same things.
 *
 * `leaderboard.category.labels.*` and `leaderboard.scope.labels.*` come from the
 * shipped bundle. Which games feed each board is a documented mapping: `blitz`
 * and `classical` split the quick and the longer math duels, `memory` is the
 * memory trio, `puzzle` is exactly the two puzzle tabs, and `xp` is account-wide.
 */
import { DAILY_PUZZLE_IDS, INFINITE_PUZZLE_IDS } from "./catalog";
import type { GameId, LeaderboardScope } from "./types";

export type LeaderboardCategory = "blitz" | "classical" | "memory" | "puzzle" | "xp";

export const LEADERBOARD_CATEGORIES: Array<{ id: LeaderboardCategory; label: string }> = [
  { id: "blitz", label: "Blitz" },
  { id: "classical", label: "Classical" },
  { id: "memory", label: "Memory" },
  { id: "puzzle", label: "Puzzle" },
  { id: "xp", label: "XP" },
];

export const LEADERBOARD_SCOPES: Array<{ id: LeaderboardScope; label: string }> = [
  { id: "global", label: "Global" },
  { id: "friends", label: "Friends" },
  { id: "college", label: "College" },
];

/** Games whose scores feed each per-category board. `xp` is account-wide. */
export const CATEGORY_GAMES: Record<Exclude<LeaderboardCategory, "xp">, GameId[]> = {
  blitz: ["sprint", "fastestfinger"],
  classical: ["dmas", "sumofsquares"],
  memory: ["mindsnap", "flashanzan", "pinballrecall"],
  puzzle: [...DAILY_PUZZLE_IDS, ...INFINITE_PUZZLE_IDS],
};
