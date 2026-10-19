/**
 * Matchmaking.
 *
 * The shipped flow is `searchOpponentV3(input) -> { waiting, ticketId,
 * botEligibleAtMs, game }`, then `pollSearchV3(input) -> { outcome,
 * botEligibleAtMs, game }`, with `abortSearchTicketV3(ticketId)` to back out.
 * This implements exactly that shape against a `search_tickets` table.
 *
 * The bot fallback is not a pretence of a human: a ticket carries the moment an
 * AlphaBot becomes eligible, the outcome says `bot`, and the game view flags the
 * seat `isBot`, so the UI can be honest about who turned up.
 */
import { randomUUID } from "node:crypto";
import { GAMES } from "@repo/core/catalog";
import type { SearchOutcomeView, SearchTicketView } from "@repo/core/protocol";
import type { GameId } from "@repo/core/types";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  players,
  playerStats,
  ratings,
  searchTickets,
  streaks,
  wallets,
} from "../db/schema";
import { env } from "../env";
import { getGame, insertGame } from "./duel";

/** How close two ratings must be for an instant pairing. */
const RATING_WINDOW = 200;

async function ratingFor(playerId: string, gameId: GameId): Promise<number> {
  const [row] = await db
    .select({ rating: ratings.rating })
    .from(ratings)
    .where(and(eq(ratings.playerId, playerId), eq(ratings.gameId, gameId)));
  return row?.rating ?? 1200;
}

/** Tickets whose owner has gone away should not keep matching. */
async function expireStaleTickets(): Promise<void> {
  await db
    .update(searchTickets)
    .set({ status: "aborted" })
    .where(
      and(
        eq(searchTickets.status, "searching"),
        sql`${searchTickets.createdAt} < now() - interval '2 minutes'`,
      ),
    );
}

export async function searchOpponent(
  playerId: string,
  gameId: GameId,
  rated = true,
): Promise<SearchTicketView> {
  await expireStaleTickets();
  const myRating = await ratingFor(playerId, gameId);
  const botEligibleAtMs = Date.now() + env.botEligibleMs;
  const botEligibleAt = new Date(botEligibleAtMs);
  const ticketId = randomUUID();

  const assignedGameId = await db.transaction(async (tx) => {
    // Two players can hit "search" in the same millisecond. Serialise the
    // matchmaking transactions per mode so the second one sees the first one's
    // committed ticket instead of both inserting a "searching" row and then
    // waiting for nobody.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${gameId})::bigint)`);

    // A waiting player with a comparable rating, oldest first: first come,
    // first served, which is the fair queue and also what keeps pairing quick.
    // The row stays locked for this whole transaction, so it cannot be matched
    // into two games by two searchers at once.
    const [opponent] = await tx
      .select({ ticketId: searchTickets.ticketId, playerId: searchTickets.playerId })
      .from(searchTickets)
      .where(
        and(
          eq(searchTickets.gameId, gameId),
          eq(searchTickets.status, "searching"),
          ne(searchTickets.playerId, playerId),
          sql`abs(${searchTickets.ticketRating} - ${myRating}) <= ${RATING_WINDOW}`,
        ),
      )
      .orderBy(asc(searchTickets.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });

    if (!opponent) {
      await tx.insert(searchTickets).values({
        ticketId,
        playerId,
        gameId,
        category: GAMES[gameId].category,
        rated,
        status: "searching",
        ticketRating: myRating,
        botEligibleAt,
      });
      return null;
    }

    const created = await insertGame(tx, {
      gameId,
      rated,
      mode: "onlineChallenge",
      createdBy: playerId,
      players: [{ playerId: opponent.playerId }, { playerId }],
    });

    await tx
      .update(searchTickets)
      .set({ status: "matched", gameIdAssigned: created, matchedAt: new Date() })
      .where(eq(searchTickets.ticketId, opponent.ticketId));

    await tx.insert(searchTickets).values({
      ticketId,
      playerId,
      gameId,
      category: GAMES[gameId].category,
      rated,
      status: "matched",
      ticketRating: myRating,
      gameIdAssigned: created,
      botEligibleAt,
      matchedAt: new Date(),
    });

    return created;
  });

  if (assignedGameId) {
    return {
      ticketId,
      waiting: false,
      botEligibleAtMs,
      game: await getGame(assignedGameId, playerId),
    };
  }

  return { ticketId, waiting: true, botEligibleAtMs, game: null };
}

export async function pollSearch(
  playerId: string,
  ticketId: string,
): Promise<SearchOutcomeView> {
  const [ticket] = await db
    .select({
      status: searchTickets.status,
      gameIdAssigned: searchTickets.gameIdAssigned,
      botEligibleAt: searchTickets.botEligibleAt,
      gameId: searchTickets.gameId,
      rated: searchTickets.rated,
    })
    .from(searchTickets)
    .where(and(eq(searchTickets.ticketId, ticketId), eq(searchTickets.playerId, playerId)));

  if (!ticket) {
    return { outcome: "aborted", botEligibleAtMs: Date.now(), game: null };
  }

  const botEligibleAtMs = ticket.botEligibleAt.getTime();

  if (ticket.status === "aborted") {
    return { outcome: "aborted", botEligibleAtMs, game: null };
  }

  if (ticket.status === "matched" && ticket.gameIdAssigned) {
    const game = await getGame(ticket.gameIdAssigned, playerId);
    // A human opponent is only reported as such when the seat really is human.
    const hasBot = game?.players.some((player) => player.isBot) ?? false;
    return { outcome: hasBot ? "bot" : "matched", botEligibleAtMs, game };
  }

  if (Date.now() >= botEligibleAtMs) {
    // Nobody showed up in time, so an AlphaBot takes the seat.
    const botId = await pickBot(playerId);
    const gameId = await db.transaction(async (tx) => {
      // The ticket may have been matched by a concurrent poll; lock it and
      // check again before seating a bot.
      const [fresh] = await tx
        .select({ status: searchTickets.status })
        .from(searchTickets)
        .where(eq(searchTickets.ticketId, ticketId))
        .for("update");
      if (fresh?.status !== "searching") return null;

      const created = await insertGame(tx, {
        gameId: ticket.gameId,
        rated: ticket.rated,
        mode: "onlineChallenge",
        createdBy: playerId,
        players: [{ playerId }, { playerId: botId, isBot: true }],
      });
      await tx
        .update(searchTickets)
        .set({ status: "matched", gameIdAssigned: created, matchedAt: new Date() })
        .where(eq(searchTickets.ticketId, ticketId));
      return created;
    });

    if (gameId) {
      return { outcome: "bot", botEligibleAtMs, game: await getGame(gameId, playerId) };
    }

    // Someone else matched it first; report what they matched.
    return pollSearch(playerId, ticketId);
  }

  return { outcome: "searching", botEligibleAtMs, game: null };
}

/** Pick a bot whose stored skill is closest to the player's rating band. */
async function pickBot(playerId: string): Promise<string> {
  const [bot] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.isBot, true))
    .orderBy(
      sql`abs(${players.botSkill} - coalesce(
        (select least(1, greatest(0, (avg(r.rating) - 1100) / 700.0))
           from ratings r where r.player_id = ${playerId}), 0.5))`,
    )
    .limit(1);

  if (bot) return bot.id;

  // No bots seeded yet (a fresh database): make one on the spot.
  const id = "bot-0";
  await db.transaction(async (tx) => {
    await tx
      .insert(players)
      .values({
        id,
        handle: "alphabot",
        displayName: "AlphaBot",
        avatarSeed: "alphabot",
        isBot: true,
        botSkill: 0.5,
      })
      .onConflictDoNothing();
    await tx.insert(playerStats).values({ playerId: id }).onConflictDoNothing();
    await tx
      .insert(wallets)
      .values({ playerId: id, skipsResetAt: "1970-01-01" })
      .onConflictDoNothing();
    await tx.insert(streaks).values({ playerId: id }).onConflictDoNothing();
  });
  return id;
}

export async function abortSearch(
  playerId: string,
  ticketId: string,
): Promise<{ aborted: boolean; game: SearchTicketView["game"] }> {
  const updated = await db
    .update(searchTickets)
    .set({ status: "aborted" })
    .where(
      and(
        eq(searchTickets.ticketId, ticketId),
        eq(searchTickets.playerId, playerId),
        eq(searchTickets.status, "searching"),
      ),
    )
    .returning({ gameIdAssigned: searchTickets.gameIdAssigned });

  const gameId = updated[0]?.gameIdAssigned;
  // `abortSearchTicketV3` returns `aborted`; cancelling is idempotent, so an
  // already-matched ticket still reports that no search is outstanding.
  return { aborted: true, game: gameId ? await getGame(gameId, playerId) : null };
}
