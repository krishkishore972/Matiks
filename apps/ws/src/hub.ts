/**
 * The live channel.
 *
 * Matchmaking, a running duel and the clock are all push, so they live on a
 * WebSocket rather than being polled. The transport is our own, but the
 * vocabulary is the shipped one: `searchOpponentV3`, `pollSearchV3`,
 * `abortSearchTicketV3`, `startGameV3`, `submitGameQuestionActions`,
 * `resignGameV3`, `replayGameStreamV3` and `syncServerTime`.
 *
 * Events are delivered from the same `game_events` stream the replay endpoint
 * reads, and each socket remembers the last stream id it was sent. A client
 * that reconnects and finds a gap calls `replay` and is told to resync when it
 * has fallen outside the window — the same contract as the original.
 *
 * This process is separate from the HTTP API: it shares only Postgres and
 * `@repo/server`, never in-process state.
 */
import type { ServerMessage, StreamEventView } from "@repo/core/protocol";
import { db } from "@repo/server/db";
import { ensurePlayer } from "@repo/server/db/repo";
import {
  finishPlayer,
  getGame,
  peekQuestion,
  readStream,
  startGame,
  submitAnswer,
} from "@repo/server/domain/duel";
import {
  abortSearch,
  pollSearch,
  searchOpponent,
} from "@repo/server/domain/matchmaking";
import { env } from "@repo/server/env";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import {
  parseClientMessage,
  playerIdSchema,
  type ClientMessageInput,
} from "./messages";

const PUSH_INTERVAL_MS = 250;

interface Session {
  socket: WebSocket;
  playerId: string | null;
  /**
   * Resolves once this socket's `players` row exists. `hello` and `search` can
   * arrive back to back, and the socket handler runs each frame concurrently,
   * so every data message awaits this instead of racing `ensurePlayer`.
   */
  ready: Promise<string | null>;
  /** gameId -> last stream id already delivered to this socket. */
  watching: Map<string, number>;
  ended: Set<string>;
}

const sessions = new Set<Session>();

function send(session: Session, message: ServerMessage): void {
  if (session.socket.readyState !== session.socket.OPEN) return;
  session.socket.send(JSON.stringify(message));
}

async function watch(session: Session, gameId: string): Promise<void> {
  const game = await getGame(gameId, session.playerId ?? undefined);
  if (!game) {
    send(session, { t: "error", message: `unknown game ${gameId}` });
    return;
  }
  session.watching.set(gameId, 0);
  session.ended.delete(gameId);
  send(session, { t: "game", game });
}

async function handleMessage(session: Session, message: ClientMessageInput): Promise<void> {
  switch (message.t) {
    case "hello": {
      session.playerId = message.playerId;
      session.ready = ensurePlayer(message.playerId).then(() => message.playerId);
      await session.ready;
      send(session, { t: "welcome", serverTime: Date.now() });
      return;
    }

    case "search": {
      const playerId = await session.ready;
      if (!playerId) return;
      const ticket = await searchOpponent(playerId, message.gameId, message.rated ?? true);
      send(session, { t: "ticket", ticket });
      if (ticket.game?.id) await watch(session, ticket.game.id);
      return;
    }

    case "poll": {
      const playerId = await session.ready;
      if (!playerId) return;
      const outcome = await pollSearch(playerId, message.ticketId);
      send(session, { t: "search", outcome });
      if (outcome.game?.id) await watch(session, outcome.game.id);
      return;
    }

    case "abort": {
      const playerId = await session.ready;
      if (!playerId) return;
      const result = await abortSearch(playerId, message.ticketId);
      send(session, {
        t: "search",
        outcome: { outcome: "aborted", botEligibleAtMs: Date.now(), game: result.game },
      });
      return;
    }

    case "start": {
      const playerId = await session.ready;
      if (!playerId) return;
      const game = await startGame(message.gameId);
      await watch(session, game.id);
      return;
    }

    case "answer": {
      const playerId = await session.ready;
      if (!playerId) return;
      const result = await submitAnswer(message.gameId, playerId, message.answer);
      send(session, {
        t: "answer",
        gameId: message.gameId,
        index: message.answer.index,
        correct: result.correct,
        score: result.score,
      });
      // The next prompt is pushed straight back so the loop never stalls; the
      // same `question.served` event also reaches the other seat via the stream.
      if (result.correct) {
        const question = await peekQuestion(message.gameId, message.answer.index + 1);
        if (question) send(session, { t: "question", gameId: message.gameId, question });
      }
      return;
    }

    case "finish": {
      const playerId = await session.ready;
      if (!playerId) return;
      await finishPlayer(message.gameId, playerId);
      return;
    }

    case "resign": {
      const playerId = await session.ready;
      if (!playerId) return;
      await finishPlayer(message.gameId, playerId, true);
      return;
    }

    case "replay": {
      const page = await readStream(db, message.gameId, message.sinceStreamId);
      if (page.resyncRequired) {
        session.watching.set(message.gameId, page.streamTip);
        send(session, {
          t: "resyncRequired",
          gameId: message.gameId,
          streamTip: page.streamTip,
          reason: page.resyncReason ?? "unknown",
        });
        return;
      }
      session.watching.set(message.gameId, page.streamTip);
      send(session, {
        t: "events",
        gameId: message.gameId,
        events: page.events as StreamEventView[],
        streamTip: page.streamTip,
      });
      return;
    }

    case "syncTime": {
      send(session, {
        t: "syncTime",
        serverTime: Date.now(),
        clientRequestTime: message.clientRequestTime,
      });
      return;
    }

    default:
      send(session, { t: "error", message: "unsupported message" });
  }
}

/* The push loop: one timer for the process, not one per socket. */
function startPushLoop(): NodeJS.Timeout {
  return setInterval(() => {
    for (const session of sessions) {
      if (!session.playerId) continue;
      for (const [gameId, since] of session.watching) {
        void (async () => {
          try {
            const page = await readStream(db, gameId, since);
            if (page.events.length > 0) {
              session.watching.set(gameId, page.streamTip);
              send(session, {
                t: "events",
                gameId,
                events: page.events as StreamEventView[],
                streamTip: page.streamTip,
              });
            }
            if (!session.ended.has(gameId)) {
              const game = await getGame(gameId, session.playerId ?? undefined);
              if (game?.status === "ended") {
                session.ended.add(gameId);
                send(session, { t: "ended", gameId, game });
              }
            }
          } catch (error) {
            console.error("[ws] push failed:", error);
          }
        })();
      }
    }
  }, PUSH_INTERVAL_MS);
}

export interface WsServer {
  wss: WebSocketServer;
  close: () => Promise<void>;
}

export function createWsServer(): WsServer {
  const wss = new WebSocketServer({ port: env.wsPort });
  const pushLoop = startPushLoop();

  wss.on("connection", (socket: WebSocket, request) => {
    // The origin check keeps other pages from opening a session on the user's
    // behalf; the id is still required in `hello`.
    const origin = request.headers.origin;
    if (origin && origin !== env.corsOrigin) {
      socket.close(1008, "origin not allowed");
      return;
    }

    const url = new URL(request.url ?? "/", "http://localhost");
    const queryPlayerId = url.searchParams.get("playerId");
    const parsedQueryId = queryPlayerId ? playerIdSchema.safeParse(queryPlayerId) : null;

    const initialPlayerId = parsedQueryId?.success ? parsedQueryId.data : null;
    const session: Session = {
      socket,
      playerId: initialPlayerId,
      ready: Promise.resolve(initialPlayerId),
      watching: new Map(),
      ended: new Set(),
    };
    sessions.add(session);

    if (initialPlayerId) {
      session.ready = ensurePlayer(initialPlayerId)
        .then(() => {
          send(session, { t: "welcome", serverTime: Date.now() });
          return initialPlayerId;
        })
        .catch((error: unknown) => {
          console.error("[ws] ensurePlayer failed:", error);
          send(session, { t: "error", message: "could not open session" });
          return null;
        });
    }

    socket.on("message", (data: RawData) => {
      void (async () => {
        const parsed = parseClientMessage(String(data));
        if (!parsed.ok) {
          send(session, { t: "error", message: parsed.error });
          return;
        }
        try {
          await handleMessage(session, parsed.message);
        } catch (error) {
          console.error("[ws] message failed:", error);
          send(session, {
            t: "error",
            message: error instanceof Error ? error.message : "internal error",
          });
        }
      })();
    });

    socket.on("error", (error) => {
      console.error("[ws] socket error:", error);
    });

    socket.on("close", () => {
      sessions.delete(session);
    });
  });

  return {
    wss,
    async close() {
      clearInterval(pushLoop);
      for (const client of wss.clients) client.terminate();
      await new Promise<void>((resolve) => {
        wss.close(() => resolve());
      });
    },
  };
}
