/**
 * Duel integration tests.
 *
 * These run against the real Postgres from docker-compose.yml, because the
 * properties worth protecting are exactly the ones that live in SQL: an answer
 * is scored once and only for the cursor, the stream is monotonic, and a
 * settlement writes rating changes. They are skipped (not failed) when no
 * database is reachable, so `pnpm test` still works offline.
 */
import { randomUUID } from "node:crypto";
import { eq, like, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, db } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { ensurePlayer, loadBundle, recordPlay } from "../src/db/repo";
import { players, searchTickets } from "../src/db/schema";
import { createGame, getGame, readStream, settleGame, startGame, submitAnswer } from "../src/domain/duel";
import { buildQuestionBank } from "../src/domain/questions";
import { abortSearch, pollSearch, searchOpponent } from "../src/domain/matchmaking";

/**
 * `describe.skipIf` is decided when the file is collected, so availability has
 * to be known then — hence a top-level probe rather than a `beforeAll` flag.
 */
const databaseAvailable = await (async () => {
  try {
    await db.execute(sql`select 1`);
    await migrate();
    return true;
  } catch {
    return false;
  }
})();

afterAll(async () => {
  if (!databaseAvailable) return;
  // Leave no test players behind: this runs against the development database,
  // and their plays would otherwise show up on the leaderboards.
  await db.delete(players).where(like(players.id, "test-%"));
  await closeDb();
});

const newPlayer = () => `test-${randomUUID()}`;

describe.skipIf(!databaseAvailable)("a duel the server referees", () => {
  it("scores each question once, for the cursor only", async () => {
    const a = newPlayer();
    const b = newPlayer();
    await ensurePlayer(a);
    await ensurePlayer(b);

    const game = await createGame({
      gameId: "sprint",
      createdBy: a,
      players: [{ playerId: a }, { playerId: b }],
    });
    await startGame(game.id);

    // The bank is reproducible from the game id, which is how the test knows
    // the answers without ever being told them.
    const bank = buildQuestionBank("arithmetic", game.id, 1200);
    const answerFor = (index: number) => bank[index].answer;

    const first = await submitAnswer(game.id, a, { index: 0, answer: answerFor(0), elapsedMs: 300 });
    expect(first.correct).toBe(true);
    expect(first.score).toBe(1);

    // The same question again: a client trying to farm points gets nothing.
    const duplicate = await submitAnswer(game.id, a, {
      index: 0,
      answer: answerFor(0),
      elapsedMs: 310,
    });
    expect(duplicate.correct).toBe(false);
    expect(duplicate.rejected).toBe("already-answered");

    // A question that was never served: refused, and the cursor does not move.
    const skipAhead = await submitAnswer(game.id, a, {
      index: 7,
      answer: answerFor(7),
      elapsedMs: 320,
    });
    expect(skipAhead.rejected).toBe("already-answered");

    const second = await submitAnswer(game.id, a, { index: 1, answer: answerFor(1), elapsedMs: 400 });
    expect(second.score).toBe(2);

    // A wrong answer costs nothing but accuracy.
    const wrong = await submitAnswer(game.id, a, { index: 2, answer: answerFor(2) + 1, elapsedMs: 500 });
    expect(wrong.correct).toBe(false);
    expect(wrong.score).toBe(2);

    const retry = await submitAnswer(game.id, a, { index: 2, answer: answerFor(2), elapsedMs: 600 });
    expect(retry.correct).toBe(true);
    expect(retry.score).toBe(3);
  });

  it("keeps the stream monotonic and replayable", async () => {
    const a = newPlayer();
    const b = newPlayer();
    await ensurePlayer(a);
    await ensurePlayer(b);

    const game = await createGame({ gameId: "sprint", players: [{ playerId: a }, { playerId: b }] });
    await startGame(game.id);

    const bank = buildQuestionBank("arithmetic", game.id, 1200);
    await submitAnswer(game.id, a, { index: 0, answer: bank[0].answer, elapsedMs: 100 });

    const all = await readStream(db, game.id, 0);
    expect(all.streamTip).toBeGreaterThan(0);
    expect(all.events.map((event) => event.streamId)).toEqual(
      [...all.events.map((event) => event.streamId)].sort((x, y) => x - y),
    );
    expect(all.events.some((event) => event.type === "game.started")).toBe(true);
    expect(all.events.some((event) => event.type === "question.served")).toBe(true);
    expect(all.events.some((event) => event.type === "answer.accepted")).toBe(true);

    // Replaying from the tip yields nothing new, and an unknown id forces a resync.
    const nothingNew = await readStream(db, game.id, all.streamTip);
    expect(nothingNew.events).toHaveLength(0);
    expect(nothingNew.resyncRequired).toBe(false);

    const bogus = await readStream(db, game.id, all.streamTip + 500);
    expect(bogus.resyncRequired).toBe(true);
    expect(bogus.resyncReason).toBe("unknown-stream-id");
  });

  it("settles with a winner, a leaderboard and rating changes", async () => {
    const a = newPlayer();
    const b = newPlayer();
    await ensurePlayer(a);
    await ensurePlayer(b);

    const game = await createGame({ gameId: "sprint", players: [{ playerId: a }, { playerId: b }] });
    await startGame(game.id);

    const bank = buildQuestionBank("arithmetic", game.id, 1200);
    for (let index = 0; index < 3; index += 1) {
      await submitAnswer(game.id, a, { index, answer: bank[index].answer, elapsedMs: 200 });
    }
    await submitAnswer(game.id, b, { index: 0, answer: bank[0].answer, elapsedMs: 200 });

    const settled = await settleGame(game.id);
    expect(settled?.status).toBe("ended");
    expect(settled?.result).not.toBeNull();
    expect(settled?.result?.isTie).toBe(false);
    expect(settled?.result?.winnerId).toBe(a);
    expect(settled?.result?.leaderboard[0]).toMatchObject({ playerId: a, rank: 1, points: 3 });
    expect(settled?.result?.leaderboard[1]).toMatchObject({ playerId: b, rank: 2, points: 1 });

    const changes = settled?.result?.ratingChanges ?? [];
    expect(changes).toHaveLength(2);
    expect(changes.find((change) => change.playerId === a)?.delta).toBeGreaterThan(0);
    expect(changes.find((change) => change.playerId === b)?.delta).toBeLessThan(0);

    // The winner's play was recorded through the ordinary play path.
    const bundleA = await loadBundle(a);
    expect(bundleA.history[0]).toMatchObject({ gameId: "sprint", score: 3 });
    expect(bundleA.ratings.find((record) => record.gameId === "sprint")?.games).toBe(1);
  });

  it("treats a draw as zero rating change for both seats", async () => {
    const a = newPlayer();
    const b = newPlayer();
    await ensurePlayer(a);
    await ensurePlayer(b);

    const before = await Promise.all([loadBundle(a), loadBundle(b)]);
    expect(before[0].ratings).toHaveLength(0);

    const outcome = await recordPlay(a, {
      result: {
        gameId: "sprint",
        score: 10,
        durationMs: 60_000,
        accuracy: 1,
        solved: true,
        at: new Date().toISOString(),
      },
      opponentScore: 10,
      isDraw: true,
    });
    expect(outcome.ratingChange).toBe(0);
    expect(outcome.won).toBeNull();
  });

  it("only scores a play that clears the mode's minimum", async () => {
    const player = newPlayer();
    await ensurePlayer(player);

    const before = await loadBundle(player);
    const tooLow = await recordPlay(player, {
      result: {
        gameId: "sprint",
        score: 1,
        durationMs: 60_000,
        accuracy: 0.2,
        solved: false,
        at: new Date().toISOString(),
      },
      opponentScore: 5,
    });
    expect(tooLow.counted).toBe(false);
    expect(tooLow.piesGained).toBe(0);

    const after = await loadBundle(player);
    expect(after.streak.current).toBe(before.streak.current);
  });
});

describe.skipIf(!databaseAvailable)("matchmaking", () => {
  it("pairs two waiting players into one game", async () => {
    const a = newPlayer();
    const b = newPlayer();
    await ensurePlayer(a);
    await ensurePlayer(b);

    // A ticket left open by an interrupted run would otherwise be picked up
    // instead of this test's, making the assertion about *whose* game it is flaky.
    await db
      .update(searchTickets)
      .set({ status: "aborted" })
      .where(eq(searchTickets.status, "searching"));

    const first = await searchOpponent(a, "sprint");
    expect(first.waiting).toBe(true);
    expect(first.game).toBeNull();
    // `botEligibleAtMs` is the documented grace window before an AlphaBot may
    // take the seat; it must be in the future for a fresh ticket.
    expect(first.botEligibleAtMs).toBeGreaterThan(Date.now());

    const second = await searchOpponent(b, "sprint");
    expect(second.waiting).toBe(false);
    expect(second.game?.players).toHaveLength(2);
    expect(second.game?.players.every((player) => !player.isBot)).toBe(true);

    const polled = await pollSearch(a, first.ticketId);
    expect(polled.outcome).toBe("matched");
    expect(polled.game?.id).toBe(second.game?.id);

    const aborted = await abortSearch(a, randomUUID());
    expect(aborted.aborted).toBe(true);
  });

  it("pairs two simultaneous searches instead of leaving both waiting", async () => {
    const a = newPlayer();
    const b = newPlayer();
    await ensurePlayer(a);
    await ensurePlayer(b);

    await db
      .update(searchTickets)
      .set({ status: "aborted" })
      .where(eq(searchTickets.status, "searching"));

    // Both players press "search" at the same instant. Without the advisory
    // lock they can each see an empty queue and both end up waiting.
    const [first, second] = await Promise.all([
      searchOpponent(a, "fastestfinger"),
      searchOpponent(b, "fastestfinger"),
    ]);

    const matched = [first, second].filter((ticket) => !ticket.waiting);
    const waiting = [first, second].filter((ticket) => ticket.waiting);
    expect(matched).toHaveLength(1);
    expect(waiting).toHaveLength(1);

    const gameId = matched[0]?.game?.id;
    expect(gameId).toBeTruthy();
    expect(matched[0]?.game?.players.every((player) => !player.isBot)).toBe(true);

    // The player whose own search lost the race learns about the game on poll.
    const waitingPlayer = first.waiting ? a : b;
    const waitingTicket = first.waiting ? first.ticketId : second.ticketId;
    const polled = await pollSearch(waitingPlayer, waitingTicket);
    expect(polled.outcome).toBe("matched");
    expect(polled.game?.id).toBe(gameId);
  });

  it("gives a lone player an AlphaBot once the window elapses", async () => {
    const player = newPlayer();
    await ensurePlayer(player);

    const ticket = await searchOpponent(player, "dmas");
    expect(ticket.waiting).toBe(true);

    // Force the window closed rather than sleeping through it.
    await db
      .update(searchTickets)
      .set({ botEligibleAt: new Date() })
      .where(eq(searchTickets.ticketId, ticket.ticketId));
    const outcome = await pollSearch(player, ticket.ticketId);
    expect(outcome.outcome).toBe("bot");
    expect(outcome.game?.players.some((candidate) => candidate.isBot)).toBe(true);

    const view = await getGame(outcome.game?.id ?? "", player);
    expect(view?.players.find((candidate) => candidate.isBot)?.displayName).toBeTruthy();
  });
});
