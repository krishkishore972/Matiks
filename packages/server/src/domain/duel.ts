/**
 * Live duels.
 *
 * The server owns a duel end to end: it creates the game, generates the
 * question bank and the answer key, serves one question at a time, validates
 * every answer against its own key, and settles the result. A client can lie
 * about nothing except how fast it types.
 *
 * Settlement deliberately reuses `recordPlay`, so a duel and a solo play award
 * XP, Pies, rating and streak through exactly the same path — the only
 * difference is that a duel passes the opponent's score in.
 */
import { randomUUID } from "node:crypto";
import { DUEL_IDS, GAMES } from "@repo/core/catalog";
import { todayKey } from "@repo/core/economy";
import { createRng, seedFromString } from "@repo/core/rng";
import type { GameCategory, GameId, GameResult } from "@repo/core/types";
import type {
  GameConfigView,
  GamePlayerView,
  GameView,
  ServableQuestion,
} from "@repo/core/protocol";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { db, type Transaction } from "../db/client";
import { recordPlay } from "../db/repo";
import {
  gamePlayers,
  gameResults,
  games,
  players,
  ratings,
  type StoredGameConfig,
} from "../db/schema";
import {
  buildQuestionBank,
  publicQuestion,
  type QuestionKind,
} from "./questions";
import { appendEvent, readStream, streamTip } from "./stream";

/**
 * Which duels the server can referee itself. The math trio has questions the
 * server can generate and check; the memory modes are generated on-device, so
 * for those the server still owns the clock, the stream and the settlement but
 * only compares the reported score.
 */
const SERVER_QUESTION_DUELS: Partial<Record<GameId, QuestionKind>> = {
  sprint: "arithmetic",
  fastestfinger: "arithmetic",
  dmas: "dmas",
};

/** `categoryOpts.*.timeLimitSeconds` from the shipped game config. */
const CATEGORY_LIMITS: Record<GameCategory, number> = {
  math: 60,
  memory: 60,
  puzzle: 300,
  classical: 90,
};

/** `mechanicsOpts.phased { perQuestionSeconds, gapSeconds }`. */
const CATEGORY_PHASED: Record<GameCategory, { perQuestionSeconds: number; gapSeconds: number }> = {
  math: { perQuestionSeconds: 20, gapSeconds: 2 },
  memory: { perQuestionSeconds: 20, gapSeconds: 2 },
  puzzle: { perQuestionSeconds: 60, gapSeconds: 3 },
  classical: { perQuestionSeconds: 30, gapSeconds: 2 },
};

/* --------------------------------------------------------------- create ---- */

export interface CreateGameInput {
  gameId: GameId;
  players: Array<{ playerId: string; isBot?: boolean; botSkill?: number }>;
  mode?: string;
  rated?: boolean;
  createdBy?: string;
}

export async function createGame(input: CreateGameInput): Promise<GameView> {
  const id = await db.transaction((tx) => insertGame(tx, input));
  const game = await getGame(id, input.createdBy);
  if (!game) throw new Error("game vanished after create");
  return game;
}

/**
 * The insert half of `createGame`, on a caller-supplied transaction.
 *
 * Matchmaking holds the opponent's ticket lock while it creates the game and
 * marks both tickets matched; sharing a transaction is what makes that atomic
 * instead of three independent statements another searcher can interleave with.
 */
export async function insertGame(tx: Transaction, input: CreateGameInput): Promise<string> {
  const meta = GAMES[input.gameId];
  const kind = SERVER_QUESTION_DUELS[input.gameId];
  const id = randomUUID();

  const config: StoredGameConfig = {
    gameId: input.gameId,
    category: meta.category,
    mode: input.mode ?? "onlineChallenge",
    type: "duel",
    rated: input.rated ?? meta.rated,
    numPlayers: input.players.length,
    timeLimitSeconds: CATEGORY_LIMITS[meta.category],
    perQuestionSeconds: CATEGORY_PHASED[meta.category].perQuestionSeconds,
    gapSeconds: CATEGORY_PHASED[meta.category].gapSeconds,
    questionSource: kind ? "server" : "client",
    // The bank is generated from the game id, so a replay rebuilds the same one.
    questions: kind ? buildQuestionBank(kind, id, 1200) : [],
  };

  await tx.insert(games).values({
    id,
    gameId: input.gameId,
    category: meta.category,
    mode: config.mode,
    type: config.type,
    status: "created",
    createdBy: input.createdBy ?? input.players[0]?.playerId ?? null,
    config,
    rated: config.rated,
  });

  for (const [seat, player] of input.players.entries()) {
    const [rating] = await tx
      .select({ rating: ratings.rating })
      .from(ratings)
      .where(and(eq(ratings.playerId, player.playerId), eq(ratings.gameId, input.gameId)));
    await tx.insert(gamePlayers).values({
      gameId: id,
      playerId: player.playerId,
      seat,
      status: "joined",
      isBot: Boolean(player.isBot),
      ratingAtCreate: rating?.rating ?? 1200,
    });
  }

  await appendEvent(tx, id, "game.created", {
    gameId: input.gameId,
    config: publicConfig(config),
  });
  for (const [seat, player] of input.players.entries()) {
    await appendEvent(
      tx,
      id,
      "player.joined",
      { seat, playerId: player.playerId, isBot: Boolean(player.isBot) },
      player.playerId,
    );
  }

  return id;
}

function publicConfig(config: StoredGameConfig): GameConfigView {
  const { questions: _questions, ...rest } = config;
  return rest;
}

/* ----------------------------------------------------------------- read ---- */

async function loadConfig(gameId: string): Promise<StoredGameConfig> {
  const [row] = await db
    .select({ config: games.config })
    .from(games)
    .where(eq(games.id, gameId));
  if (!row) throw new Error(`unknown game ${gameId}`);
  return row.config;
}

export async function getGame(gameId: string, viewerId?: string): Promise<GameView | null> {
  const [row] = await db
    .select({
      id: games.id,
      status: games.status,
      createdBy: games.createdBy,
      config: games.config,
      createdAt: games.createdAt,
      startedAt: games.startedAt,
    })
    .from(games)
    .where(eq(games.id, gameId));
  if (!row) return null;

  const playerRows = await db
    .select({
      playerId: gamePlayers.playerId,
      seat: gamePlayers.seat,
      score: gamePlayers.score,
      correct: gamePlayers.correct,
      incorrect: gamePlayers.incorrect,
      status: gamePlayers.status,
      isBot: gamePlayers.isBot,
      ratingAtCreate: gamePlayers.ratingAtCreate,
      displayName: players.displayName,
      avatarSeed: players.avatarSeed,
      country: players.country,
    })
    .from(gamePlayers)
    .innerJoin(players, eq(players.id, gamePlayers.playerId))
    .where(eq(gamePlayers.gameId, gameId))
    .orderBy(gamePlayers.seat);

  const [result] = await db
    .select()
    .from(gameResults)
    .where(eq(gameResults.gameId, gameId));

  const config = row.config;
  const timeLimitMs = config.timeLimitSeconds * 1000;

  return {
    id: row.id,
    status: row.status as GameView["status"],
    config: publicConfig(config),
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    endTime: row.startedAt ? row.startedAt.getTime() + timeLimitMs : null,
    players: playerRows.map(
      (p): GamePlayerView => ({
        playerId: p.playerId,
        displayName: p.displayName,
        avatarSeed: p.avatarSeed,
        country: p.country,
        seat: p.seat,
        score: p.score,
        correct: p.correct,
        incorrect: p.incorrect,
        status: p.status,
        ratingAtCreate: p.ratingAtCreate,
        isBot: p.isBot,
        isYou: p.playerId === viewerId,
      }),
    ),
    streamTip: await streamTip(db, gameId),
    result: result
      ? {
          winnerId: result.winnerId,
          isTie: result.isTie,
          leaderboard: result.leaderboard,
          ratingChanges: result.ratingChanges,
        }
      : null,
  };
}

/* ---------------------------------------------------------------- start ---- */

export async function startGame(gameId: string): Promise<GameView> {
  const config = await loadConfig(gameId);
  const startedAt = new Date();
  const endTime = startedAt.getTime() + config.timeLimitSeconds * 1000;

  const started = await db.transaction(async (tx) => {
    const flipped = await tx
      .update(games)
      .set({ status: "started", startedAt })
      .where(and(eq(games.id, gameId), eq(games.status, "created")))
      .returning({ id: games.id });

    // Both seats call `start`; only the call that actually flipped the row may
    // seed the stream and the timers, or the round would start twice.
    if (flipped.length === 0) return false;

    await tx
      .update(gamePlayers)
      .set({ status: "playing", startedAt })
      .where(eq(gamePlayers.gameId, gameId));

    await appendEvent(tx, gameId, "game.started", {
      startedAt: startedAt.toISOString(),
      endTime,
      questionCount: config.questions.length,
      perQuestionSeconds: config.perQuestionSeconds,
      gapSeconds: config.gapSeconds,
      questionSource: config.questionSource,
    });
    return true;
  });

  if (started) {
    // The first question is served immediately for server-authored modes.
    await serveQuestion(gameId, 0);
    startBotDriver(gameId, endTime);
    scheduleAutoEnd(gameId, endTime);
  }

  const game = await getGame(gameId);
  if (!game) throw new Error("game vanished after start");
  return game;
}

/** Push the prompt (never the answer) onto the stream. */
export async function serveQuestion(
  gameId: string,
  index: number,
): Promise<ServableQuestion | null> {
  const config = await loadConfig(gameId);
  const question = config.questions[index];
  if (!question) return null;
  const served: ServableQuestion = { index, ...publicQuestion(question) };
  await db.transaction((tx) => appendEvent(tx, gameId, "question.served", served));
  return served;
}

/** The prompt for an index, without appending it to the stream. */
export async function peekQuestion(
  gameId: string,
  index: number,
): Promise<ServableQuestion | null> {
  const config = await loadConfig(gameId);
  const question = config.questions[index];
  if (!question) return null;
  return { index, ...publicQuestion(question) };
}

/* --------------------------------------------------------------- answer ---- */

export interface AnswerResult {
  correct: boolean;
  score: number;
  rejected?: "not-started" | "already-finished" | "out-of-time" | "bad-index" | "already-answered";
}

export async function submitAnswer(
  gameId: string,
  playerId: string,
  submission: { index: number; answer: number | string; elapsedMs: number },
): Promise<AnswerResult> {
  const config = await loadConfig(gameId);
  const [game] = await db
    .select({ status: games.status, startedAt: games.startedAt })
    .from(games)
    .where(eq(games.id, gameId));

  if (!game || game.status !== "started") {
    return { correct: false, score: 0, rejected: "not-started" };
  }
  if (
    game.startedAt &&
    Date.now() > game.startedAt.getTime() + config.timeLimitSeconds * 1000
  ) {
    return { correct: false, score: 0, rejected: "out-of-time" };
  }

  const question = config.questions[submission.index];
  if (!question) return { correct: false, score: 0, rejected: "bad-index" };

  // The answer key is the server's. `Number()` on the submission so a client
  // that sends "43" rather than 43 is still marked correctly.
  const correct = question.answer === Number(submission.answer);

  let score = 0;
  const guarded = await db.transaction(async (tx) => {
    // Scored only when the submission is for the player's current cursor. A
    // repeat submission, or one for a question that was never served, is
    // dropped without touching the score or the stream.
    if (correct) {
      const updated = await tx
        .update(gamePlayers)
        .set({
          score: sql`${gamePlayers.score} + 1`,
          correct: sql`${gamePlayers.correct} + 1`,
          cursor: sql`${gamePlayers.cursor} + 1`,
        })
        .where(
          and(
            eq(gamePlayers.gameId, gameId),
            eq(gamePlayers.playerId, playerId),
            eq(gamePlayers.cursor, submission.index),
          ),
        )
        .returning({ score: gamePlayers.score });
      if (!updated[0]) return false;
      score = updated[0].score;
      await appendEvent(
        tx,
        gameId,
        "answer.accepted",
        { index: submission.index, correct: true, score, elapsedMs: submission.elapsedMs },
        playerId,
      );
      return true;
    }

    const updated = await tx
      .update(gamePlayers)
      .set({ incorrect: sql`${gamePlayers.incorrect} + 1` })
      .where(
        and(
          eq(gamePlayers.gameId, gameId),
          eq(gamePlayers.playerId, playerId),
          eq(gamePlayers.cursor, submission.index),
        ),
      )
      .returning({ score: gamePlayers.score });
    if (!updated[0]) return false;
    score = updated[0].score;
    await appendEvent(
      tx,
      gameId,
      "answer.rejected",
      { index: submission.index, correct: false, score, elapsedMs: submission.elapsedMs },
      playerId,
    );
    return true;
  });

  if (!guarded) return { correct: false, score, rejected: "already-answered" };

  // Keep the next prompt flowing so the client never has to ask.
  if (correct && config.questionSource === "server") {
    await serveQuestion(gameId, submission.index + 1);
  }

  return { correct, score };
}

/* -------------------------------------------------------------- finish ---- */

export async function finishPlayer(
  gameId: string,
  playerId: string,
  resigned = false,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(gamePlayers)
      .set({ status: resigned ? "resigned" : "finished", endedAt: new Date() })
      .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.playerId, playerId)));
    await appendEvent(
      tx,
      gameId,
      resigned ? "player.resigned" : "player.finished",
      {},
      playerId,
    );
  });
  await maybeSettle(gameId);
}

async function maybeSettle(gameId: string): Promise<void> {
  const [game] = await db
    .select({ status: games.status })
    .from(games)
    .where(eq(games.id, gameId));
  if (!game || game.status !== "started") return;

  const [pending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(gamePlayers)
    .where(
      and(
        eq(gamePlayers.gameId, gameId),
        notInArray(gamePlayers.status, ["finished", "resigned"]),
      ),
    );
  if ((pending?.count ?? 0) === 0) await settleGame(gameId);
}

/* -------------------------------------------------------------- settle ---- */

export async function settleGame(gameId: string): Promise<GameView | null> {
  const config = await loadConfig(gameId);
  const game = await getGame(gameId);
  if (!game || game.status === "ended") return game;

  clearGameTimers(gameId);

  const startedMs = game.startedAt ? new Date(game.startedAt).getTime() : Date.now();
  const durationMs = Math.max(1, Date.now() - startedMs);
  const ordered = [...game.players].sort((a, b) => b.score - a.score);

  const best = ordered[0];
  const runnerUp = ordered[1];
  const isTie = Boolean(runnerUp && best.score === runnerUp.score);
  const winnerId = isTie || !best ? null : best.playerId;

  const leaderboard = ordered.map((player, index) => ({
    playerId: player.playerId,
    rank: index + 1,
    points: player.score,
    correct: player.correct,
    incorrect: player.incorrect,
  }));

  // Humans settle through the normal play path, so rewards and rating changes
  // are identical to a solo play by construction.
  const ratingChanges: Array<{
    playerId: string;
    before: number;
    after: number;
    delta: number;
  }> = [];
  for (const player of game.players) {
    if (player.isBot) continue;
    const opponent = game.players.find(
      (candidate) => candidate.playerId !== player.playerId,
    );
    const attempts = player.correct + player.incorrect;
    const result: GameResult = {
      gameId: config.gameId,
      score: player.score,
      durationMs,
      accuracy: attempts > 0 ? player.correct / attempts : 0,
      solved: player.score >= GAMES[config.gameId].minScore,
      at: new Date().toISOString(),
      detail: { mistakes: player.incorrect, duel: true },
    };
    const outcome = await recordPlay(player.playerId, {
      result,
      opponentScore: opponent?.score,
      // A draw must not read as a loss for both seats.
      isDraw: isTie,
      expectedMs: config.timeLimitSeconds * 1000,
    });
    ratingChanges.push({
      playerId: player.playerId,
      before: outcome.ratingBefore,
      after: outcome.ratingAfter,
      delta: outcome.ratingChange,
    });
  }

  await db.transaction(async (tx) => {
    await tx.update(games).set({ status: "ended", endedAt: new Date() }).where(eq(games.id, gameId));
    await tx
      .insert(gameResults)
      .values({ gameId, winnerId, isTie, leaderboard, ratingChanges })
      .onConflictDoUpdate({
        target: gameResults.gameId,
        set: {
          winnerId,
          isTie,
          leaderboard,
          ratingChanges,
          settledAt: new Date(),
        },
      });
    await appendEvent(tx, gameId, "game.ended", {
      winnerId,
      isTie,
      leaderboard,
      ratingChanges,
    });
  });

  return getGame(gameId);
}

/* ----------------------------------------------------------- bot driver ---- */

/**
 * AlphaBot, driven by real timers against the same stream a human uses.
 *
 * The shipped app has a literal `AlphaBot` in the bundle and a
 * `botEligibleAtMs` grace window before it may be seated, so a bot here is not
 * a deception: it is the documented fallback, it is flagged `isBot`, and the UI
 * shows it as the AlphaBot rather than pretending a person showed up.
 */
const botTimers = new Map<string, NodeJS.Timeout[]>();

function startBotDriver(gameId: string, endTime: number): void {
  void (async () => {
    const bots = await db
      .select({ playerId: gamePlayers.playerId, botSkill: players.botSkill })
      .from(gamePlayers)
      .innerJoin(players, eq(players.id, gamePlayers.playerId))
      .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.isBot, true)));
    if (bots.length === 0) return;

    const bot = bots[0];
    const rng = createRng(seedFromString(`bot-play:${gameId}`));
    // A stronger bot answers more often and misses less.
    const gapMs = 2600 - Math.round(bot.botSkill * 1400);
    const accuracy = 0.55 + bot.botSkill * 0.43;
    const timers: NodeJS.Timeout[] = [];
    let botIndex = 0;

    const tick = () => {
      const now = Date.now();
      if (now >= endTime) return;
      void (async () => {
        const correct = rng.next() < accuracy;
        await db.transaction(async (tx) => {
          if (correct) {
            const updated = await tx
              .update(gamePlayers)
              .set({
                score: sql`${gamePlayers.score} + 1`,
                correct: sql`${gamePlayers.correct} + 1`,
                cursor: sql`${gamePlayers.cursor} + 1`,
              })
              .where(
                and(
                  eq(gamePlayers.gameId, gameId),
                  eq(gamePlayers.playerId, bot.playerId),
                ),
              )
              .returning({ score: gamePlayers.score });
            await appendEvent(
              tx,
              gameId,
              "answer.accepted",
              {
                index: botIndex,
                correct: true,
                score: updated[0]?.score ?? 0,
                elapsedMs: gapMs,
              },
              bot.playerId,
            );
          } else {
            await tx
              .update(gamePlayers)
              .set({ incorrect: sql`${gamePlayers.incorrect} + 1` })
              .where(
                and(
                  eq(gamePlayers.gameId, gameId),
                  eq(gamePlayers.playerId, bot.playerId),
                ),
              );
            await appendEvent(
              tx,
              gameId,
              "answer.rejected",
              { index: botIndex, correct: false, elapsedMs: gapMs },
              bot.playerId,
            );
          }
        });
        botIndex += 1;
        if (Date.now() < endTime) {
          const next = setTimeout(tick, Math.max(400, gapMs + rng.int(700) - 350));
          timers.push(next);
          botTimers.set(gameId, timers);
        } else {
          await finishPlayer(gameId, bot.playerId);
        }
      })();
    };

    const first = setTimeout(tick, Math.max(600, gapMs));
    timers.push(first);
    botTimers.set(gameId, timers);
  })();
}

function clearGameTimers(gameId: string): void {
  for (const timer of botTimers.get(gameId) ?? []) clearTimeout(timer);
  botTimers.delete(gameId);
  const auto = autoEndTimers.get(gameId);
  if (auto) clearTimeout(auto);
  autoEndTimers.delete(gameId);
}

const autoEndTimers = new Map<string, NodeJS.Timeout>();

function scheduleAutoEnd(gameId: string, endTime: number): void {
  const delay = Math.max(0, endTime - Date.now()) + 250;
  const timer = setTimeout(() => {
    void (async () => {
      // Everyone still playing is finished for them; then the game settles.
      const stillPlaying = await db
        .select({ playerId: gamePlayers.playerId })
        .from(gamePlayers)
        .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.status, "playing")));
      for (const row of stillPlaying) await finishPlayer(gameId, row.playerId);
      await settleGame(gameId);
    })();
  }, delay);
  autoEndTimers.set(gameId, timer);
}

/* ---------------------------------------------------------- replay/sync ---- */

export { readStream };

export function isRatedDuel(gameId: GameId): boolean {
  return DUEL_IDS.includes(gameId);
}

export { todayKey };
