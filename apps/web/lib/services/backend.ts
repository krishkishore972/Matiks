/**
 * Data backend.
 *
 * `Backend` is the seam between the UI and whatever is storing the player's
 * data. `LocalBackend` implements it against `localStorage` + deterministic
 * simulation, which is what the web recreation ships with. A real service would
 * implement the same interface against HTTP and nothing in the UI would change.
 *
 * Simulated data is always flagged (`LeaderboardEntry.simulated`) and every
 * simulated surface is labelled in the UI. Nothing here pretends to be a live
 * opponent.
 */
import {
  MAX_SHIELDS,
  STORE_ITEMS,
  XP_BOOSTER_MS,
  levelFromXp,
  todayKey,
  yesterdayKey,
} from "@repo/core/economy";
import type { LevelInfo } from "@repo/core/economy";
import { DAILY_PUZZLE_IDS, DUEL_IDS, GAMES, INFINITE_PUZZLE_IDS } from "../catalog";
import { createRng, seedFromString } from "../rng";
import { countsForProgress, qualityBand, ratingDelta, xpFor } from "../scoring";
import type {
  DailyChallengeState,
  Difficulty,
  GameId,
  GameRatingRecord,
  GameResult,
  LeaderboardEntry,
  LeaderboardScope,
  PlayerProfile,
  PlayerStats,
  QualityBand,
  StreakState,
  WalletState,
} from "../types";
import {
  buildRoster,
  type LeaderboardCategory,
} from "./leaderboard";
import { HttpBackend } from "./httpBackend";
import {
  applyResultToCounters,
  emptyCounters,
  evaluateQuests,
  type QuestCounters,
  type QuestProgress,
} from "./quests";
import { readJson, remove, writeJson } from "./storage";

const STORAGE_KEY = "matiks:v1:state";

/* ------------------------------------------------------------------ state -- */

interface PersistedState {
  version: 1;
  profile: PlayerProfile;
  stats: PlayerStats;
  wallet: WalletState;
  streak: StreakState;
  ratings: GameRatingRecord[];
  history: GameResult[];
  daily: Record<string, DailyChallengeState>;
  questDay: string;
  counters: QuestCounters;
  claimedQuests: string[];
  owned: string[];
}

export interface ProfileBundle {
  profile: PlayerProfile;
  stats: PlayerStats;
  wallet: WalletState;
  streak: StreakState;
  ratings: GameRatingRecord[];
  history: GameResult[];
  daily: DailyChallengeState;
  quests: QuestProgress[];
  level: LevelInfo;
  pies: number;
}

export interface RecordRequest {
  result: GameResult;
  /** Opponent score for duel results (drives the Elo-style delta). */
  opponentScore?: number;
  difficulty?: Difficulty;
  /** Expected solve time for the quality band, in milliseconds. */
  expectedMs?: number;
  /** True when the play finishes a daily-challenge puzzle. */
  isDaily?: boolean;
}

export interface RecordOutcome {
  score: number;
  counted: boolean;
  xpGained: number;
  piesGained: number;
  ratingBefore: number;
  ratingAfter: number;
  ratingChange: number;
  band: QualityBand;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  streak: StreakState;
  won: boolean | null;
  dualedOpponentScore: number | null;
}

export interface PurchaseResult {
  ok: boolean;
  reason?: "insufficient" | "maxed" | "already-owned";
  wallet: WalletState;
}

export interface Backend {
  load(): Promise<ProfileBundle>;
  record(request: RecordRequest): Promise<RecordOutcome>;
  leaderboard(
    scope: LeaderboardScope,
    category: LeaderboardCategory,
  ): Promise<LeaderboardEntry[]>;
  purchase(itemId: string): Promise<PurchaseResult>;
  claimQuest(questId: string): Promise<ProfileBundle | null>;
  updateProfile(patch: Partial<PlayerProfile>): Promise<PlayerProfile>;
  reset(): Promise<ProfileBundle>;
}

/* ------------------------------------------------------------- helpers ---- */

/**
 * Day keys, seeds, the level curve and the store are shared with the server so
 * a play is scored the same way in both places. See `packages/core`.
 */
export {
  MAX_SHIELDS,
  STORE_ITEMS,
  STREAK_SHIELD_COST,
  XP_BOOSTER_MS,
  dailySeed,
  levelFromXp,
  practiceSeed,
  todayKey,
  yesterdayKey,
} from "@repo/core/economy";
export type { LevelInfo, StoreItem } from "@repo/core/economy";

function defaultState(): PersistedState {
  const now = new Date().toISOString();
  return {
    version: 1,
    profile: {
      id: "local-player",
      handle: "you",
      displayName: "You",
      avatarSeed: "you",
      country: "IN",
      college: "Ashoka University",
      joinedAt: now,
      isPro: false,
      bio: "Playing the Matiks web recreation.",
    },
    stats: {
      gamesPlayed: 0,
      gamesSolved: 0,
      totalTimeMs: 0,
      xp: 0,
      leaguePoints: 0,
      perfectRuns: 0,
    },
    wallet: {
      pies: 500,
      skips: 3,
      skipsResetAt: todayKey(),
      xpBoosterUntil: null,
    },
    streak: { current: 0, best: 0, lastPlayedDay: null, claimedDays: [], shields: 1 },
    ratings: [],
    history: [],
    daily: {},
    questDay: todayKey(),
    counters: emptyCounters(),
    claimedQuests: [],
    owned: [],
  };
}

function loadState(): PersistedState {
  const state = readJson<PersistedState>(STORAGE_KEY, defaultState());
  const fallback = defaultState();
  return {
    ...fallback,
    ...state,
    profile: { ...fallback.profile, ...state.profile },
    stats: { ...fallback.stats, ...state.stats },
    wallet: { ...fallback.wallet, ...state.wallet },
    streak: { ...fallback.streak, ...state.streak },
    counters: { ...fallback.counters, ...state.counters },
    ratings: state.ratings ?? [],
    history: state.history ?? [],
    daily: state.daily ?? {},
    owned: state.owned ?? [],
    claimedQuests: state.claimedQuests ?? [],
  };
}

/* ------------------------------------------------------------- backend ---- */


class LocalBackend implements Backend {
  private state: PersistedState;

  constructor() {
    this.state = loadState();
    this.rollDailyCounters();
  }

  private persist(): void {
    writeJson(STORAGE_KEY, this.state);
  }

  /** Quest counters are daily; roll them over when the date changes. */
  private rollDailyCounters(): void {
    const day = todayKey();
    if (this.state.questDay !== day) {
      this.state.questDay = day;
      this.state.counters = emptyCounters();
      this.state.claimedQuests = [];
    }
    if (this.state.wallet.skipsResetAt !== day) {
      this.state.wallet.skipsResetAt = day;
      this.state.wallet.skips = 3;
    }
  }

  private dailyState(day = todayKey()): DailyChallengeState {
    return this.state.daily[day] ?? { dayKey: day, completed: [], claimed: false };
  }

  private touchStreak(): StreakState {
    const today = todayKey();
    const streak = { ...this.state.streak };
    if (streak.lastPlayedDay === today) return streak;

    const yesterday = yesterdayKey();
    if (streak.lastPlayedDay === yesterday) streak.current += 1;
    else if (streak.current > 0 && streak.shields > 0) {
      // A held shield absorbs the missed day (inferred behaviour: the store
      // description says it "protects your streak").
      streak.shields -= 1;
      streak.current += 1;
    } else streak.current = 1;

    streak.lastPlayedDay = today;
    streak.best = Math.max(streak.best, streak.current);
    this.state.streak = streak;
    return streak;
  }

  private ratingFor(gameId: GameId): GameRatingRecord {
    return (
      this.state.ratings.find((record) => record.gameId === gameId) ?? {
        gameId,
        rating: 1200,
        games: 0,
        bestScore: 0,
      }
    );
  }

  private saveRating(record: GameRatingRecord): void {
    const others = this.state.ratings.filter((r) => r.gameId !== record.gameId);
    this.state.ratings = [...others, record];
  }

  private boosterActive(): boolean {
    const until = this.state.wallet.xpBoosterUntil;
    return Boolean(until && new Date(until).getTime() > Date.now());
  }

  private bundle(): ProfileBundle {
    return {
      profile: this.state.profile,
      stats: this.state.stats,
      wallet: this.state.wallet,
      streak: this.state.streak,
      ratings: [...this.state.ratings].sort((a, b) => a.gameId.localeCompare(b.gameId)),
      history: [...this.state.history].slice(0, 50),
      daily: this.dailyState(),
      quests: evaluateQuests(this.state.counters, this.state.claimedQuests),
      level: levelFromXp(this.state.stats.xp),
      pies: this.state.wallet.pies,
    };
  }

  async load(): Promise<ProfileBundle> {
    this.rollDailyCounters();
    return this.bundle();
  }

  async record(request: RecordRequest): Promise<RecordOutcome> {
    this.rollDailyCounters();
    const { result } = request;
    const meta = GAMES[result.gameId];
    const before = this.ratingFor(result.gameId);

    // Duel outcome: solved and beating the simulated opponent's score.
    const isDuel = DUEL_IDS.includes(result.gameId);
    const opponentScore = request.opponentScore ?? null;
    const won = isDuel && opponentScore !== null ? result.score > opponentScore : null;

    const opponentRating = 1200 + (opponentScore !== null ? Math.min(400, Math.round(opponentScore / 2)) : 0);
    const change =
      isDuel && won !== null
        ? ratingDelta(before.rating, opponentRating, won, before.games)
        : result.solved
          ? Math.max(1, Math.round((result.accuracy - 0.5) * 10))
          : -6;

    const after: GameRatingRecord = {
      gameId: result.gameId,
      rating: Math.max(100, before.rating + change),
      games: before.games + 1,
      bestScore: Math.max(before.bestScore, result.score),
    };
    this.saveRating(after);

    const multiplier = this.boosterActive() ? 2 : 1;
    const xpGained = xpFor(result, multiplier);
    // Pies are described in the app as earnings for finishing boards *above the
    // minimum score*, so a sub-minimum finish pays nothing.
    const counted = countsForProgress(result);
    const piesGained = counted ? 10 + Math.round(result.score / 200) : 0;
    const levelBefore = levelFromXp(this.state.stats.xp).level;

    this.state.stats = {
      gamesPlayed: this.state.stats.gamesPlayed + 1,
      gamesSolved: this.state.stats.gamesSolved + (result.solved ? 1 : 0),
      totalTimeMs: this.state.stats.totalTimeMs + result.durationMs,
      xp: this.state.stats.xp + xpGained,
      leaguePoints: this.state.stats.leaguePoints + (meta.rated ? Math.max(0, Math.round(result.score / 20)) : 0),
      perfectRuns: this.state.stats.perfectRuns + (result.solved && result.accuracy >= 1 ? 1 : 0),
    };
    this.state.wallet = { ...this.state.wallet, pies: this.state.wallet.pies + piesGained };
    this.state.history = [result, ...this.state.history].slice(0, 50);

    this.state.counters = applyResultToCounters(
      this.state.counters,
      result,
      Boolean(request.isDaily),
    );

    if (request.isDaily && result.solved) {
      const day = todayKey();
      const daily = this.dailyState(day);
      if (!daily.completed.includes(result.gameId)) {
        this.state.daily[day] = { ...daily, completed: [...daily.completed, result.gameId] };
      }
    }

    if (counted) this.touchStreak();

    const band: QualityBand = qualityBand(
      result.durationMs,
      request.expectedMs ?? Math.max(30_000, result.durationMs),
    );

    this.persist();
    return {
      score: result.score,
      counted,
      xpGained,
      piesGained,
      ratingBefore: before.rating,
      ratingAfter: after.rating,
      ratingChange: change,
      band,
      levelBefore,
      levelAfter: levelFromXp(this.state.stats.xp).level,
      leveledUp: levelFromXp(this.state.stats.xp).level > levelBefore,
      streak: this.state.streak,
      won,
      dualedOpponentScore: opponentScore,
    };
  }

  async leaderboard(
    scope: LeaderboardScope,
    category: LeaderboardCategory,
  ): Promise<LeaderboardEntry[]> {
    return buildRoster(scope, category, todayKey(), this.state.stats, this.state.profile);
  }

  async purchase(itemId: string): Promise<PurchaseResult> {
    const item = STORE_ITEMS.find((candidate) => candidate.id === itemId);
    if (!item) return { ok: false, reason: "already-owned", wallet: this.state.wallet };
    if (this.state.wallet.pies < item.cost) {
      return { ok: false, reason: "insufficient", wallet: this.state.wallet };
    }

    if (itemId === "streak-shield") {
      if (this.state.streak.shields >= MAX_SHIELDS) {
        return { ok: false, reason: "maxed", wallet: this.state.wallet };
      }
      this.state.streak = { ...this.state.streak, shields: this.state.streak.shields + 1 };
    } else if (itemId === "snacc-skip") {
      this.state.wallet = { ...this.state.wallet, skips: this.state.wallet.skips + 1 };
    } else if (itemId === "xp-booster") {
      const from = this.boosterActive() ? new Date(this.state.wallet.xpBoosterUntil as string).getTime() : Date.now();
      this.state.wallet = {
        ...this.state.wallet,
        xpBoosterUntil: new Date(from + XP_BOOSTER_MS).toISOString(),
      };
    }

    this.state.wallet = { ...this.state.wallet, pies: this.state.wallet.pies - item.cost };
    this.state.owned = [...new Set([...this.state.owned, itemId])];
    this.persist();
    return { ok: true, wallet: this.state.wallet };
  }

  async claimQuest(questId: string): Promise<ProfileBundle | null> {
    const progress = evaluateQuests(this.state.counters, this.state.claimedQuests).find(
      (entry) => entry.quest.id === questId,
    );
    if (!progress || !progress.complete || progress.claimed) return null;

    this.state.claimedQuests = [...this.state.claimedQuests, questId];
    const reward = progress.quest.reward;
    this.state.wallet = { ...this.state.wallet, pies: this.state.wallet.pies + (reward.pies ?? 0) };
    this.state.stats = { ...this.state.stats, xp: this.state.stats.xp + (reward.xp ?? 0) };
    this.persist();
    return this.bundle();
  }

  async updateProfile(patch: Partial<PlayerProfile>): Promise<PlayerProfile> {
    this.state.profile = { ...this.state.profile, ...patch };
    this.persist();
    return this.state.profile;
  }

  async reset(): Promise<ProfileBundle> {
    remove(STORAGE_KEY);
    this.state = defaultState();
    this.persist();
    return this.bundle();
  }
}

let backend: Backend | null = null;

/**
 * The one place the app chooses between the server and local storage.
 *
 * `NEXT_PUBLIC_API_URL` is read at build time by Next, so an unset value is a
 * deliberate "run this offline" switch rather than a runtime surprise.
 */
export function getBackend(): Backend {
  if (!backend) {
    const api = process.env.NEXT_PUBLIC_API_URL;
    backend = api ? new HttpBackend(api) : new LocalBackend();
  }
  return backend;
}

/** True when the app is talking to `apps/api` rather than local storage. */
export function isServerBacked(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_API_URL);
}

export function resetBackend(): void {
  backend = null;
}

/* --------------------------------------------------------------- sim ----- */

/**
 * Simulated duel opponent. Deterministic per game+day so a duel is repeatable,
 * and clearly labelled as simulated in the UI.
 */
export function simulateOpponent(gameId: GameId, dayKey = todayKey()): {
  name: string;
  score: number;
  rating: number;
} {
  const rng = createRng(seedFromString(`opponent:${gameId}:${dayKey}`));
  const names = ["aarav", "nisha", "dev", "tanvi", "kabir", "meera", "ishaan", "riya"];
  const base: Record<string, number> = {
    sprint: 14,
    fastestfinger: 12,
    dmas: 10,
    mindsnap: 72,
    flashanzan: 110,
    pinballrecall: 8,
    sumofsquares: 10,
  };
  const floor = base[gameId] ?? 10;
  return {
    name: `${names[rng.int(names.length)]}_bot`,
    score: Math.round(floor * (0.75 + rng.next() * 0.7)),
    rating: 1150 + rng.int(180),
  };
}

/** Puzzles grouped for the Puzzles tab. */
export const PUZZLE_TABS: { daily: GameId[]; infinite: GameId[] } = {
  daily: [...DAILY_PUZZLE_IDS],
  infinite: [...INFINITE_PUZZLE_IDS],
};
