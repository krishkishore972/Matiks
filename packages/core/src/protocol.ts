/**
 * The wire protocol, shared by the server that implements it and the client
 * that speaks it.
 *
 * Field names follow the shapes recovered from the shipped bundle
 * (`getLiveGameV3`, `replayGameStreamV3`, `searchOpponentV3`, `pollSearchV3`,
 * `abortSearchTicketV3`, `syncServerTime`) and are documented in
 * docs/reference/server-protocol.md. Where the real service is GraphQL this is
 * JSON-over-HTTP and JSON-over-WebSocket with the same vocabulary, so the two
 * can be compared without a translation table.
 */
import type { GameCategory, GameId, LeaderboardScope } from "./types";
import type { LeaderboardCategory } from "./leaderboard";

/* --------------------------------------------------------------- games ---- */

export interface GamePlayerView {
  playerId: string;
  displayName: string;
  avatarSeed: string;
  country: string;
  seat: number;
  score: number;
  correct: number;
  incorrect: number;
  status: string;
  ratingAtCreate: number;
  isBot: boolean;
  isYou: boolean;
}

export interface GameConfigView {
  gameId: GameId;
  category: GameCategory;
  mode: string;
  type: string;
  rated: boolean;
  numPlayers: number;
  timeLimitSeconds: number;
  /** `mechanicsOpts.phased` in the shipped config. */
  perQuestionSeconds: number;
  gapSeconds: number;
  /**
   * `server` when the server owns the question bank and the answer key (the
   * math duels), `client` when the mode's questions are generated on-device and
   * only the score is compared.
   */
  questionSource: "server" | "client";
}

export interface GameLeaderboardRow {
  playerId: string;
  rank: number;
  points: number;
  correct: number;
  incorrect: number;
}

export interface GameRatingChange {
  playerId: string;
  before: number;
  after: number;
  delta: number;
}

export interface GameResultView {
  winnerId: string | null;
  isTie: boolean;
  leaderboard: GameLeaderboardRow[];
  ratingChanges: GameRatingChange[];
}

export interface GameView {
  id: string;
  status: "created" | "started" | "ended" | "cancelled";
  config: GameConfigView;
  createdBy: string | null;
  createdAt: string;
  startedAt: string | null;
  /** Authoritative end of the round, in server epoch milliseconds. */
  endTime: number | null;
  players: GamePlayerView[];
  streamTip: number;
  result: GameResultView | null;
}

/* ------------------------------------------------------------ questions ---- */

export interface ServableQuestion {
  index: number;
  prompt: string;
  choices?: number[];
}

export interface SubmittedAnswer {
  index: number;
  answer: number | string;
  elapsedMs: number;
}

/* --------------------------------------------------------- matchmaking ---- */

export interface SearchTicketView {
  ticketId: string;
  waiting: boolean;
  /** Server epoch ms at which an AlphaBot may fill the seat. */
  botEligibleAtMs: number;
  game: GameView | null;
}

export interface SearchOutcomeView {
  outcome: "searching" | "matched" | "bot" | "aborted";
  botEligibleAtMs: number;
  game: GameView | null;
}

/* ------------------------------------------------------------ the wire ---- */

export interface StreamEventView {
  streamId: number;
  type: string;
  payload: unknown;
  actor?: string | null;
}

export interface TimeSyncView {
  serverTime: number;
  clientRequestTime: number;
}

/** Client to server. */
export type ClientMessage =
  | { t: "hello"; playerId: string }
  | { t: "search"; gameId: GameId; rated?: boolean }
  | { t: "poll"; ticketId: string }
  | { t: "abort"; ticketId: string }
  | { t: "start"; gameId: string }
  | { t: "answer"; gameId: string; answer: SubmittedAnswer }
  | { t: "finish"; gameId: string }
  | { t: "resign"; gameId: string }
  | { t: "replay"; gameId: string; sinceStreamId: number }
  | { t: "syncTime"; clientRequestTime: number };

/** Server to client. */
export type ServerMessage =
  | { t: "welcome"; serverTime: number }
  | { t: "ticket"; ticket: SearchTicketView }
  | { t: "search"; outcome: SearchOutcomeView }
  | { t: "game"; game: GameView }
  | { t: "question"; gameId: string; question: ServableQuestion }
  | { t: "answer"; gameId: string; index: number; correct: boolean; score: number }
  | { t: "events"; gameId: string; events: StreamEventView[]; streamTip: number }
  | { t: "resyncRequired"; gameId: string; streamTip: number; reason: string }
  | { t: "ended"; gameId: string; game: GameView }
  | { t: "syncTime"; serverTime: number; clientRequestTime: number }
  | { t: "error"; message: string };

/* -------------------------------------------------------------- rest ----- */

export interface LeaderboardQuery {
  scope: LeaderboardScope;
  category: LeaderboardCategory;
}

/** Event types the server may put on a game stream. */
export type DuelEventType =
  | "game.created"
  | "player.joined"
  | "game.started"
  | "answer.accepted"
  | "answer.rejected"
  | "player.finished"
  | "player.resigned"
  | "game.ended";
