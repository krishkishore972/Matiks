/**
 * The authoritative game event stream.
 *
 * This mirrors the shipped protocol exactly: `replayGameStreamV3(gameId,
 * sinceStreamId)` returns `events { streamId type payload }`, a `streamTip`, and
 * `resyncRequired` / `resyncReason`. Every mutation of a live game is an event,
 * so a client that drops offline can replay whatever it missed instead of
 * guessing, and two clients can never disagree about the score.
 */
import { and, eq, gt, sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { gameEvents, games } from "../db/schema";

export type GameEventType =
  | "game.created"
  | "game.settled"
  | "game.started"
  | "game.ended"
  | "game.cancelled"
  | "player.joined"
  | "player.ready"
  | "player.finished"
  | "player.resigned"
  | "question.served"
  | "answer.accepted"
  | "answer.rejected";

export interface GameEvent {
  streamId: number;
  type: GameEventType | string;
  payload: unknown;
  actor?: string | null;
  at?: string;
}

export interface StreamPage {
  events: GameEvent[];
  streamTip: number;
  resyncRequired: boolean;
  resyncReason: string | null;
}

/**
 * How far back a client may replay before it is told to resync from scratch.
 * The shipped app has RESYNC_GRACE_MS / BOARD_RESYNC_GRACE_MS for the same
 * purpose on the client side; this is the server's retention equivalent.
 */
export const REPLAY_WINDOW_EVENTS = 400;

/**
 * Append one event and return it. The parent `games` row is locked first so
 * concurrent appends for the same game cannot pick the same stream id.
 */
export async function appendEvent(
  q: Executor,
  gameId: string,
  type: GameEventType | string,
  payload: unknown = {},
  actor?: string | null,
): Promise<GameEvent> {
  await q.select({ id: games.id }).from(games).where(eq(games.id, gameId)).for("update");

  const [row] = await q
    .select({ tip: sql<number>`coalesce(max(${gameEvents.streamId}), 0)` })
    .from(gameEvents)
    .where(eq(gameEvents.gameId, gameId));
  const streamId = (row?.tip ?? 0) + 1;

  await q.insert(gameEvents).values({
    gameId,
    streamId,
    type,
    payload,
    actor: actor ?? null,
  });

  return { streamId, type, payload, actor: actor ?? null };
}

export async function appendEvents(
  q: Executor,
  gameId: string,
  entries: Array<{ type: GameEventType | string; payload?: unknown; actor?: string | null }>,
): Promise<GameEvent[]> {
  const appended: GameEvent[] = [];
  for (const entry of entries) {
    appended.push(await appendEvent(q, gameId, entry.type, entry.payload ?? {}, entry.actor));
  }
  return appended;
}

/** The newest stream id for a game, or 0 when nothing has been recorded. */
export async function streamTip(q: Executor, gameId: string): Promise<number> {
  const [row] = await q
    .select({ tip: sql<number>`coalesce(max(${gameEvents.streamId}), 0)` })
    .from(gameEvents)
    .where(eq(gameEvents.gameId, gameId));
  return row?.tip ?? 0;
}

/**
 * Replay a game stream. `sinceStreamId` is the last event the client already
 * has, matching the shipped `replayGameStreamV3` contract exactly.
 *
 * `resyncRequired` is set when the client is so far behind that the tail is no
 * longer a superset of what it missed — the client is then expected to rebuild
 * from the tip it is given rather than trust its local state.
 */
export async function readStream(
  q: Executor,
  gameId: string,
  sinceStreamId: number,
): Promise<StreamPage> {
  const tip = await streamTip(q, gameId);

  const rows = await q
    .select({
      streamId: gameEvents.streamId,
      type: gameEvents.type,
      payload: gameEvents.payload,
      actor: gameEvents.actor,
      at: gameEvents.at,
    })
    .from(gameEvents)
    .where(and(eq(gameEvents.gameId, gameId), gt(gameEvents.streamId, sinceStreamId)))
    .orderBy(gameEvents.streamId);

  let resyncRequired = false;
  let resyncReason: string | null = null;

  if (sinceStreamId > tip) {
    // The client claims to have events the server never issued (a different
    // game, or a stale local database). It cannot be trusted.
    resyncRequired = true;
    resyncReason = "unknown-stream-id";
  } else if (rows.length >= REPLAY_WINDOW_EVENTS) {
    resyncRequired = true;
    resyncReason = "replay-window-exceeded";
  }

  return {
    events: rows.map((row) => ({
      streamId: row.streamId,
      type: row.type,
      payload: row.payload,
      actor: row.actor,
      at: row.at.toISOString(),
    })),
    streamTip: tip,
    resyncRequired,
    resyncReason,
  };
}
