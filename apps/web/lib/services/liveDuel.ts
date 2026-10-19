/**
 * WebSocket client for the live duel channel.
 *
 * Deliberately thin: it owns the socket, the reconnect-free lifecycle and the
 * server clock offset, and hands decoded messages to the component. All the
 * rules live on the server, which is the point.
 */
import type {
  ClientMessage,
  GameView,
  SearchOutcomeView,
  SearchTicketView,
  ServableQuestion,
  ServerMessage,
  StreamEventView,
  SubmittedAnswer,
} from "@repo/core/protocol";
import type { GameId } from "@repo/core/types";
import { apiBaseUrl, localPlayerId } from "./httpBackend";

export interface LiveDuelHandlers {
  onWelcome?: (serverTime: number) => void;
  onTicket?: (ticket: SearchTicketView) => void;
  onSearch?: (outcome: SearchOutcomeView) => void;
  onGame?: (game: GameView) => void;
  onQuestion?: (question: ServableQuestion) => void;
  onAnswerResult?: (result: { index: number; correct: boolean; score: number }) => void;
  onEnded?: (game: GameView) => void;
  onEvent?: (event: StreamEventView) => void;
  onError?: (message: string) => void;
  onClose?: () => void;
}

/**
 * The live channel is its own process (`apps/ws`), so `NEXT_PUBLIC_WS_URL`
 * names it directly. When only the API URL is set, fall back to the old
 * same-origin `<api>/ws` derivation: that is still correct for a single-process
 * deployment, and it keeps a stale `.env` from silently disabling duels.
 */
export function liveSocketUrl(): string | null {
  const explicit = (process.env.NEXT_PUBLIC_WS_URL ?? "").replace(/\/$/, "");
  const base = explicit || apiBaseUrl();
  if (!base) return null;
  const url = new URL(base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  if (url.pathname === "/" || url.pathname === "") url.pathname = "/ws";
  url.search = new URLSearchParams({ playerId: localPlayerId() }).toString();
  return url.toString();
}

export class LiveDuelClient {
  private socket: WebSocket | null = null;
  private handlers: LiveDuelHandlers;
  /** serverTime - Date.now(), refreshed by the syncTime exchange. */
  private clockOffset = 0;

  constructor(handlers: LiveDuelHandlers) {
    this.handlers = handlers;
  }

  connect(): Promise<void> {
    const url = liveSocketUrl();
    if (!url)
      return Promise.reject(
        new Error("Set NEXT_PUBLIC_API_URL or NEXT_PUBLIC_WS_URL to play live duels."),
      );

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.onopen = () => {
        this.send({ t: "hello", playerId: localPlayerId() });
        this.send({ t: "syncTime", clientRequestTime: Date.now() });
        resolve();
      };

      socket.onerror = () => reject(new Error("Could not reach the game server."));

      socket.onmessage = (event: MessageEvent<string>) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(event.data) as ServerMessage;
        } catch {
          return;
        }
        this.dispatch(message);
      };

      socket.onclose = () => {
        this.socket = null;
        this.handlers.onClose?.();
      };
    });
  }

  private dispatch(message: ServerMessage): void {
    switch (message.t) {
      case "welcome":
        this.clockOffset = message.serverTime - Date.now();
        this.handlers.onWelcome?.(message.serverTime);
        return;
      case "syncTime":
        this.clockOffset = message.serverTime - Date.now();
        return;
      case "ticket":
        this.handlers.onTicket?.(message.ticket);
        return;
      case "search":
        this.handlers.onSearch?.(message.outcome);
        return;
      case "game":
        this.handlers.onGame?.(message.game);
        return;
      case "question":
        this.handlers.onQuestion?.(message.question);
        return;
      case "answer":
        this.handlers.onAnswerResult?.({
          index: message.index,
          correct: message.correct,
          score: message.score,
        });
        return;
      case "ended":
        this.handlers.onEnded?.(message.game);
        return;
      case "resyncRequired":
        this.handlers.onError?.("Out of sync with the server — reopening the board.");
        return;
      case "events":
        for (const event of message.events) {
          this.handlers.onEvent?.(event);
          if (event.type === "question.served") {
            this.handlers.onQuestion?.(event.payload as ServableQuestion);
          }
        }
        return;
      case "error":
        this.handlers.onError?.(message.message);
        return;
    }
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  search(gameId: GameId): void {
    this.send({ t: "search", gameId });
  }

  poll(ticketId: string): void {
    this.send({ t: "poll", ticketId });
  }

  abort(ticketId: string): void {
    this.send({ t: "abort", ticketId });
  }

  start(gameId: string): void {
    this.send({ t: "start", gameId });
  }

  answer(gameId: string, answer: SubmittedAnswer): void {
    this.send({ t: "answer", gameId, answer });
  }

  resign(gameId: string): void {
    this.send({ t: "resign", gameId });
  }

  /** Server time, corrected for the measured offset. */
  now(): number {
    return Date.now() + this.clockOffset;
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
  }
}
