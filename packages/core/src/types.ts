/**
 * Shared domain types for the Matiks web recreation.
 *
 * Vocabulary is taken from the shipped Android artifact (`com.matiks.app`
 * 1.51.0): `gameType.*` (crossMath, kenKenPuzzle, mathMazePuzzle, sudoku,
 * hectoc, mindSnap, flashAnzan, fastestFinger, pinBallRecall, dmas, abilityDuels),
 * `infinitePuzzle.*` (queens, tango, zip, patches, pipes, flipMatch, wend),
 * `leaderboard.category.labels.*` (blitz, classical, memory, puzzle, xp) and
 * `dailyChallenge.type.*`.
 */

export type GameCategory = "math" | "memory" | "puzzle" | "classical";

export type DailyPuzzleId = "sudoku" | "kenken" | "crossmath" | "mathmaze" | "hectoc";

export type InfinitePuzzleId = "queens" | "tango" | "zip" | "pipes" | "wend";

export type DuelId =
  | "sprint"
  | "mindsnap"
  | "flashanzan"
  | "pinballrecall"
  | "fastestfinger"
  | "dmas"
  | "sumofsquares";

export type GameId = DailyPuzzleId | InfinitePuzzleId | DuelId;

export type Difficulty = "easy" | "medium" | "hard" | "expert";

export type LeaderboardScope = "global" | "friends" | "college";

export interface GameMeta {
  id: GameId;
  title: string;
  subtitle: string;
  category: GameCategory;
  /** Lucide icon name, resolved in the UI layer. */
  icon: string;
  accent: string;
  skills: string[];
  howToPlay: string[];
  /** Minimum score for a play to count, per the quest rules string. */
  minScore: number;
  /** Rated games contribute to a skill rating. */
  rated: boolean;
  /** Daily, date-seeded puzzles. */
  daily: boolean;
}

/** Result of a single finished puzzle or duel attempt. */
export interface GameResult {
  gameId: GameId;
  /** Higher is better. */
  score: number;
  durationMs: number;
  /** 0..1, counting every wrong attempt (per the accuracy redefinition). */
  accuracy: number;
  solved: boolean;
  detail?: Record<string, number | string | boolean>;
  at: string;
}

export type QualityBand = "ZAP" | "FLOW" | "GRIND" | "CHOKE" | "FREEZE";

export type BlitzShape =
  | "Dominator"
  | "Comeback"
  | "Clutch"
  | "Almost"
  | "Close Call"
  | "Slip up"
  | "Blunder"
  | "Crushed";

export interface PlayerProfile {
  id: string;
  handle: string;
  displayName: string;
  avatarSeed: string;
  country: string;
  college: string;
  joinedAt: string;
  isPro: boolean;
  bio?: string;
}

export interface WalletState {
  /** Soft currency ("Pies" / "Pi Coins") used for hints, skips and shields. */
  pies: number;
  /** Snacc skips available today. */
  skips: number;
  skipsResetAt: string;
  /** XXP boost multiplier end timestamp, or null. */
  xpBoosterUntil: string | null;
}

export interface StreakState {
  current: number;
  best: number;
  lastPlayedDay: string | null;
  claimedDays: number[];
  /** Max 2 held at a time in the reference app. */
  shields: number;
}

export interface PlayerStats {
  gamesPlayed: number;
  gamesSolved: number;
  totalTimeMs: number;
  xp: number;
  leaguePoints: number;
  perfectRuns: number;
}

export interface DailyChallengeState {
  dayKey: string;
  completed: GameId[];
  claimed: boolean;
}

export interface GameRatingRecord {
  gameId: GameId;
  rating: number;
  games: number;
  bestScore: number;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  displayName: string;
  avatarSeed: string;
  country: string;
  score: number;
  gamesPlayed: number;
  college?: string;
  isCurrentPlayer?: boolean;
  isPro?: boolean;
  /** Simulated opponents are always labelled as such in the UI. */
  simulated?: boolean;
}
