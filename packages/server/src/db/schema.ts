/**
 * The database schema, in Drizzle.
 *
 * Column names follow the shapes recovered from the shipped bundle (see
 * `docs/reference/server-protocol.md`): a game carries `config`; the live game
 * is an append-only `game_events` stream keyed by a monotonic `stream_id` that
 * `replayGameStreamV3(gameId, sinceStreamId)` walks; a `search_tickets` row backs
 * `searchOpponentV3` / `pollSearchV3` / `abortSearchTicketV3` and carries
 * `bot_eligible_at`.
 *
 * Migrations are generated from this file by `drizzle-kit generate` and applied
 * by `drizzle-orm`'s migrator, so the SQL and the schema cannot drift.
 */
import type { QuestCounters } from "@repo/core/quests";
import { emptyCounters } from "@repo/core/quests";
import type {
  GameConfigView,
  GameLeaderboardRow,
  GameRatingChange,
} from "@repo/core/protocol";
import type { GameCategory, GameId } from "@repo/core/types";
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { DuelQuestion } from "../domain/questions";

const tz = { withTimezone: true, mode: "date" } as const;

/** `games.config`: the public duel config plus the server-only answer key. */
export interface StoredGameConfig extends GameConfigView {
  gameId: GameId;
  category: GameCategory;
  questions: DuelQuestion[];
}

export const players = pgTable("players", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarSeed: text("avatar_seed").notNull().default(""),
  country: text("country").notNull().default("IN"),
  college: text("college").notNull().default(""),
  bio: text("bio").notNull().default(""),
  isPro: boolean("is_pro").notNull().default(false),
  isBot: boolean("is_bot").notNull().default(false),
  /** AlphaBot difficulty band, 0..1; decides how strong a fallback opponent is. */
  botSkill: real("bot_skill").notNull().default(0),
  createdAt: timestamp("created_at", tz).notNull().defaultNow(),
});

export const playerStats = pgTable("player_stats", {
  playerId: text("player_id")
    .primaryKey()
    .references(() => players.id, { onDelete: "cascade" }),
  gamesPlayed: integer("games_played").notNull().default(0),
  gamesSolved: integer("games_solved").notNull().default(0),
  totalTimeMs: bigint("total_time_ms", { mode: "number" }).notNull().default(0),
  xp: integer("xp").notNull().default(0),
  leaguePoints: integer("league_points").notNull().default(0),
  perfectRuns: integer("perfect_runs").notNull().default(0),
});

export const wallets = pgTable("wallets", {
  playerId: text("player_id")
    .primaryKey()
    .references(() => players.id, { onDelete: "cascade" }),
  pies: integer("pies").notNull().default(500),
  skips: integer("skips").notNull().default(3),
  skipsResetAt: text("skips_reset_at").notNull(),
  xpBoosterUntil: timestamp("xp_booster_until", tz),
});

export const streaks = pgTable("streaks", {
  playerId: text("player_id")
    .primaryKey()
    .references(() => players.id, { onDelete: "cascade" }),
  current: integer("current").notNull().default(0),
  best: integer("best").notNull().default(0),
  lastPlayedDay: text("last_played_day"),
  claimedDays: text("claimed_days").array().notNull().default([]),
  /** Spendable Streak Shields. Lives here because it modifies a streak. */
  shields: integer("shields").notNull().default(1),
});

export const ratings = pgTable(
  "ratings",
  {
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    gameId: text("game_id").$type<GameId>().notNull(),
    rating: integer("rating").notNull().default(1200),
    games: integer("games").notNull().default(0),
    bestScore: integer("best_score").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.playerId, table.gameId] })],
);

export const plays = pgTable(
  "plays",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    gameId: text("game_id").$type<GameId>().notNull(),
    score: integer("score").notNull(),
    solved: boolean("solved").notNull(),
    accuracy: real("accuracy").notNull(),
    durationMs: integer("duration_ms").notNull(),
    mistakes: integer("mistakes").notNull().default(0),
    difficulty: text("difficulty").notNull().default("medium"),
    isDaily: boolean("is_daily").notNull().default(false),
    playedAt: timestamp("played_at", tz).notNull().defaultNow(),
  },
  (table) => [
    index("plays_player_recent").on(table.playerId, table.playedAt.desc()),
    index("plays_game_score").on(table.gameId, table.score.desc()),
  ],
);

export const dailyCompletions = pgTable(
  "daily_completions",
  {
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    dayKey: text("day_key").notNull(),
    gameId: text("game_id").$type<GameId>().notNull(),
    completedAt: timestamp("completed_at", tz).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.playerId, table.dayKey, table.gameId] }),
  ],
);

export const questState = pgTable(
  "quest_state",
  {
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    dayKey: text("day_key").notNull(),
    counters: jsonb("counters")
      .$type<QuestCounters>()
      .notNull()
      .default(emptyCounters()),
    claimed: text("claimed").array().notNull().default([]),
  },
  (table) => [primaryKey({ columns: [table.playerId, table.dayKey] })],
);

/* ---------------------------------------------------------------- duels ---- */

export const searchTickets = pgTable(
  "search_tickets",
  {
    ticketId: text("ticket_id").primaryKey(),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    gameId: text("game_id").$type<GameId>().notNull(),
    category: text("category").notNull().default("classical"),
    rated: boolean("rated").notNull().default(true),
    /** searching | matched | aborted */
    status: text("status").notNull().default("searching"),
    ticketRating: integer("ticket_rating").notNull().default(1200),
    gameIdAssigned: text("game_id_assigned"),
    botEligibleAt: timestamp("bot_eligible_at", tz).notNull(),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
    matchedAt: timestamp("matched_at", tz),
  },
  (table) => [
    index("search_open").on(table.gameId, table.status, table.ticketRating),
  ],
);

export const games = pgTable(
  "games",
  {
    id: text("id").primaryKey(),
    /** The mode, e.g. `sprint`. */
    gameId: text("game_id").$type<GameId>().notNull(),
    category: text("category").$type<GameCategory>().notNull(),
    /** asyncChallenge | onlineChallenge | practice */
    mode: text("mode").notNull(),
    type: text("type").notNull().default("duel"),
    /** created | started | ended | cancelled */
    status: text("status").notNull().default("created"),
    createdBy: text("created_by").references(() => players.id, {
      onDelete: "set null",
    }),
    config: jsonb("config").$type<StoredGameConfig>().notNull(),
    rated: boolean("rated").notNull().default(true),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
    startedAt: timestamp("started_at", tz),
    endedAt: timestamp("ended_at", tz),
  },
  (table) => [index("games_recent").on(table.createdAt.desc())],
);

export const gamePlayers = pgTable(
  "game_players",
  {
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    seat: integer("seat").notNull(),
    /** joined | ready | playing | finished | resigned */
    status: text("status").notNull().default("joined"),
    /**
     * The index this player may answer next. Answers are only scored when they
     * arrive for the cursor, so a client cannot re-answer a question to farm
     * points, and cannot skip ahead to one it was never served.
     */
    cursor: integer("cursor").notNull().default(0),
    isBot: boolean("is_bot").notNull().default(false),
    ratingAtCreate: integer("rating_at_create").notNull().default(1200),
    score: integer("score").notNull().default(0),
    correct: integer("correct").notNull().default(0),
    incorrect: integer("incorrect").notNull().default(0),
    startedAt: timestamp("started_at", tz),
    endedAt: timestamp("ended_at", tz),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.seat] }),
    index("game_players_by_player").on(table.playerId),
  ],
);

/**
 * The authoritative event stream. `stream_id` is monotonic per game; clients
 * replay with `sinceStreamId` exactly as `replayGameStreamV3` does.
 */
export const gameEvents = pgTable(
  "game_events",
  {
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    streamId: bigint("stream_id", { mode: "number" }).notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    actor: text("actor"),
    at: timestamp("at", tz).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.gameId, table.streamId] })],
);

export const gameResults = pgTable("game_results", {
  gameId: text("game_id")
    .primaryKey()
    .references(() => games.id, { onDelete: "cascade" }),
  winnerId: text("winner_id"),
  isTie: boolean("is_tie").notNull().default(false),
  leaderboard: jsonb("leaderboard")
    .$type<GameLeaderboardRow[]>()
    .notNull()
    .default([]),
  ratingChanges: jsonb("rating_changes")
    .$type<GameRatingChange[]>()
    .notNull()
    .default([]),
  settledAt: timestamp("settled_at", tz).notNull().defaultNow(),
});
