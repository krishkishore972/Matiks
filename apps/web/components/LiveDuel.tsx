"use client";

/**
 * A live duel against another browser, refereed by `apps/api`.
 *
 * Nothing here decides the score: the server serves a prompt, checks the answer
 * against its own key and reports back. This component only draws it and keeps
 * the two seats in view.
 *
 * The AlphaBot is labelled as such. It is the documented fallback — the shipped
 * app exposes the same grace window as `botEligibleAtMs` — and it is never
 * presented as a person.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GamePlayerView,
  GameView,
  ServableQuestion,
  StreamEventView,
} from "@repo/core/protocol";
import type { GameId } from "@repo/core/types";
import { GAMES } from "../lib/catalog";
import { LiveDuelClient, liveSocketUrl } from "../lib/services/liveDuel";
import { usePlayer } from "../lib/state/player";
import { cn, formatClock } from "../lib/utils/cn";
import { Button, Card, InfoNote, Pill, StateBlock } from "./ui";
import { Icon } from "./icons";

type Phase = "connecting" | "searching" | "starting" | "playing" | "ended" | "error";

export function LiveDuel({ gameId, onExit }: { gameId: GameId; onExit: () => void }) {
  const meta = GAMES[gameId];
  const { reload } = usePlayer();
  const clientRef = useRef<LiveDuelClient | null>(null);

  const [phase, setPhase] = useState<Phase>("connecting");
  const [game, setGame] = useState<GameView | null>(null);
  const [ticket, setTicket] = useState<{ id: string; botAt: number } | null>(null);
  const [question, setQuestion] = useState<ServableQuestion | null>(null);
  const [input, setInput] = useState("");
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [feedback, setFeedback] = useState<"none" | "right" | "wrong">("none");
  const [error, setError] = useState<string | null>(null);
  const [waitingForBotMs, setWaitingForBotMs] = useState<number | null>(null);

  /**
   * Values the socket handlers need but that must not restart the socket.
   * `endTime` and the seat id change as the game progresses; putting them in
   * the effect's dependency array would tear down the connection mid-duel.
   */
  const endTimeRef = useRef<number | null>(null);
  const myIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    endTimeRef.current = game?.endTime ?? null;
    myIdRef.current = game?.players.find((player) => player.isYou)?.playerId ?? null;
  }, [game]);

  /* ------------------------------------------------------------ lifecycle -- */

  useEffect(() => {
    startedRef.current = false;
    const client = new LiveDuelClient({
      onTicket: (next) => {
        if (next.waiting) {
          setPhase("searching");
          setTicket({ id: next.ticketId, botAt: next.botEligibleAtMs });
        }
      },
      onSearch: (outcome) => {
        if (outcome.outcome === "matched" || outcome.outcome === "bot") {
          setWaitingForBotMs(null);
        }
        if (outcome.outcome === "aborted") {
          setPhase("error");
          setError("The search was cancelled.");
        }
      },
      onGame: (next) => {
        setGame(next);
        setMyScore(next.players.find((player) => player.isYou)?.score ?? 0);
        setOpponentScore(next.players.find((player) => !player.isYou)?.score ?? 0);

        if (next.status === "ended") {
          setPhase("ended");
          return;
        }
        if (next.status === "created") {
          setPhase("starting");
          if (!startedRef.current) {
            startedRef.current = true;
            // Both seats ask to start; the server lets exactly one of them do it.
            client.start(next.id);
          }
          return;
        }
        setPhase("playing");
      },
      onQuestion: (next) => setQuestion(next),
      onAnswerResult: ({ correct, score }) => {
        setMyScore(score);
        setFeedback(correct ? "right" : "wrong");
        setInput("");
        window.setTimeout(() => setFeedback("none"), 200);
      },
      onEvent: (event: StreamEventView) => {
        const payload = event.payload as { score?: number } | null;
        if (event.type === "game.started") {
          setPhase("playing");
          return;
        }
        if (
          (event.type === "answer.accepted" || event.type === "answer.rejected") &&
          event.actor &&
          event.actor !== myIdRef.current &&
          typeof payload?.score === "number"
        ) {
          setOpponentScore(payload.score);
        }
      },
      onEnded: (next) => {
        setGame(next);
        setPhase("ended");
      },
      onError: (message) => setError(message),
      onClose: () => {
        setPhase((current) => (current === "ended" ? current : "error"));
        setError((current) => current ?? "The connection to the game server closed.");
      },
    });

    clientRef.current = client;

    void (async () => {
      try {
        await client.connect();
        setPhase("searching");
        client.search(gameId);
      } catch (cause) {
        setPhase("error");
        setError(cause instanceof Error ? cause.message : "Could not reach the game server.");
      }
    })();

    const timer = window.setInterval(() => {
      const end = endTimeRef.current;
      if (!end) return;
      setRemainingMs(Math.max(0, end - client.now()));
    }, 200);

    return () => {
      window.clearInterval(timer);
      client.close();
    };
  }, [gameId]);

  /* Poll while searching, and count down to the AlphaBot window. */
  useEffect(() => {
    if (!ticket) return;
    const poll = window.setInterval(() => {
      clientRef.current?.poll(ticket.id);
    }, 1000);
    return () => window.clearInterval(poll);
  }, [ticket]);

  useEffect(() => {
    if (!ticket || phase !== "searching") return;
    const update = () => {
      const wait = ticket.botAt - Date.now();
      setWaitingForBotMs(wait > 0 ? wait : 0);
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [ticket, phase]);

  useEffect(() => {
    if (phase === "ended") void reload();
  }, [phase, reload]);

  /* -------------------------------------------------------------- answers -- */

  const submit = useCallback(
    (value: number) => {
      if (!game || !question) return;
      clientRef.current?.answer(game.id, {
        index: question.index,
        answer: value,
        elapsedMs: Math.max(0, (game.config.timeLimitSeconds * 1000 - remainingMs) | 0),
      });
    },
    [game, question, remainingMs],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    const value = Number(input);
    if (Number.isFinite(value) && input.trim() !== "") submit(value);
  };

  const resign = () => {
    if (game) clientRef.current?.resign(game.id);
    onExit();
  };

  /* ------------------------------------------------------------------ UI -- */

  if (!liveSocketUrl()) {
    return (
      <StateBlock
        state="empty"
        title="No game server configured"
        message="Set NEXT_PUBLIC_API_URL to the API's address to play live duels."
      />
    );
  }

  if (phase === "connecting") {
    return <StateBlock state="loading" title="Connecting" message="Reaching the game server…" />;
  }

  if (phase === "error") {
    return (
      <div className="space-y-3">
        <StateBlock
          state="error"
          title="Live duel unavailable"
          message={error ?? "Something went wrong."}
        />
        <Button fullWidth icon="ArrowLeft" onClick={onExit}>
          Back to practice
        </Button>
      </div>
    );
  }

  const opponent = game?.players.find((player) => !player.isYou) ?? null;
  const me = game?.players.find((player) => player.isYou) ?? null;
  const ended = phase === "ended";
  const result = game?.result ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={resign}
          className="flex items-center gap-1 text-sm text-ink-300"
        >
          <Icon name="ArrowLeft" className="h-4 w-4" />
          {phase === "playing" ? "Forfeit" : "Back"}
        </button>
        <Pill icon="Clock" tone={remainingMs < 10_000 && phase === "playing" ? "danger" : "neutral"}>
          {formatClock(remainingMs)}
        </Pill>
      </div>

      <div>
        <h1 className="text-xl font-black tracking-tight text-ink-50">{meta.title}</h1>
        <p className="text-xs text-ink-400">
          Live duel · {meta.category} · {game?.config.timeLimitSeconds ?? 60}s
        </p>
      </div>

      {phase === "searching" ? (
        <Card className="space-y-3 text-center">
          <p className="text-sm font-bold text-ink-100">Finding an opponent…</p>
          <p className="text-xs text-ink-400">
            {waitingForBotMs !== null && waitingForBotMs > 0
              ? `AlphaBot can take the seat in ${Math.ceil(waitingForBotMs / 1000)}s`
              : "Checking for an AlphaBot…"}
          </p>
          <div className="mx-auto h-1 w-40 overflow-hidden rounded-full bg-ink-800">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-lime-brand" />
          </div>
          <Button
            variant="ghost"
            icon="X"
            onClick={() => {
              if (ticket) clientRef.current?.abort(ticket.id);
              clientRef.current?.close();
              onExit();
            }}
          >
            Cancel search
          </Button>
        </Card>
      ) : null}

      {phase === "starting" && game ? (
        <Card className="space-y-2 text-center">
          <p className="text-sm font-bold text-ink-100">Opponent found</p>
          <p className="text-xs text-ink-400">Starting the round…</p>
          <PlayerRow player={me} opponent={opponent} />
        </Card>
      ) : null}

      {(phase === "playing" || phase === "starting") && game ? (
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <ScoreChip label={me?.displayName ?? "You"} score={myScore} tone="lime" />
            <span className="text-[11px] font-bold tracking-widest text-ink-500 uppercase">vs</span>
            <ScoreChip
              label={opponent ? `${opponent.displayName}${opponent.isBot ? " · AlphaBot" : ""}` : "…"}
              score={opponentScore}
              tone={opponent?.isBot ? "violet" : "sky"}
            />
          </div>

          {question ? (
            <>
              <div
                className={cn(
                  "rounded-2xl border p-6 text-center transition",
                  feedback === "right" && "border-lime-brand bg-lime-brand/10",
                  feedback === "wrong" && "border-berry bg-berry/10",
                  feedback === "none" && "border-ink-700 bg-ink-900",
                )}
              >
                <p className="text-3xl font-black tracking-tight text-ink-50">{question.prompt}</p>
              </div>

              {question.choices ? (
                <div className="grid grid-cols-2 gap-2">
                  {question.choices.map((choice) => (
                    <Button key={choice} variant="secondary" onClick={() => submit(choice)}>
                      {choice}
                    </Button>
                  ))}
                </div>
              ) : (
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value.replace(/[^0-9-]/g, ""))}
                  onKeyDown={onKeyDown}
                  inputMode="numeric"
                  autoFocus
                  placeholder="Answer"
                  className="tabular w-full rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-center text-xl font-bold text-ink-50 outline-none focus:border-lime-brand"
                />
              )}
            </>
          ) : (
            <p className="py-6 text-center text-xs text-ink-400">Waiting for the next question…</p>
          )}
        </Card>
      ) : null}

      {ended && game ? (
        <Card className="space-y-3">
          <p className="text-center text-lg font-black text-ink-50">
            {result?.isTie
              ? "Draw"
              : result?.winnerId === me?.playerId
                ? "You won"
                : result?.winnerId
                  ? "You lost"
                  : "Round over"}
          </p>

          <div className="space-y-1">
            {(result?.leaderboard ?? []).map((row) => {
              const player = game.players.find((candidate) => candidate.playerId === row.playerId);
              return (
                <div
                  key={row.playerId}
                  className={cn(
                    "flex items-center justify-between rounded-xl px-3 py-2 text-sm",
                    player?.isYou ? "bg-lime-brand/10 text-lime-brand" : "bg-ink-800 text-ink-200",
                  )}
                >
                  <span className="font-semibold">
                    {row.rank}. {player?.displayName ?? row.playerId}
                    {player?.isBot ? " · AlphaBot" : ""}
                  </span>
                  <span className="tabular font-bold">
                    {row.points} <span className="text-xs font-normal text-ink-400">pts</span>
                  </span>
                </div>
              );
            })}
          </div>

          {(result?.ratingChanges ?? []).length > 0 ? (
            <p className="text-center text-xs text-ink-400">
              {result?.ratingChanges
                .map((change) => {
                  const player = game.players.find((candidate) => candidate.playerId === change.playerId);
                  return `${player?.isYou ? "You" : player?.displayName ?? "Rival"} ${change.delta >= 0 ? "+" : ""}${change.delta}`;
                })
                .join(" · ")}
            </p>
          ) : null}

          {game.players.some((player) => player.isBot) ? (
            <InfoNote icon="Bot">
              This round was against the AlphaBot because no human was waiting. It is the server's fallback, not
              a simulated person.
            </InfoNote>
          ) : null}

          <div className="flex gap-2">
            <Button fullWidth icon="RotateCcw" onClick={onExit}>
              Play again
            </Button>
            <Button fullWidth variant="secondary" icon="Home" onClick={onExit}>
              Back
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function ScoreChip({
  label,
  score,
  tone,
}: {
  label: string;
  score: number;
  tone: "lime" | "sky" | "violet";
}) {
  const tones = {
    lime: "text-lime-brand",
    sky: "text-sky-brand",
    violet: "text-violet-brand",
  } as const;
  return (
    <div className="min-w-0 flex-1 text-center">
      <p className="truncate text-[11px] font-semibold text-ink-400">{label}</p>
      <p className={cn("tabular text-2xl font-black", tones[tone])}>{score}</p>
    </div>
  );
}

function PlayerRow({
  player,
  opponent,
}: {
  player: GamePlayerView | null;
  opponent: GamePlayerView | null;
}) {
  return (
    <div className="flex items-center justify-center gap-3 text-xs text-ink-300">
      <span className="font-semibold text-ink-100">{player?.displayName ?? "You"}</span>
      <span className="text-ink-500">vs</span>
      <span className="font-semibold text-ink-100">
        {opponent?.displayName ?? "…"}
        {opponent?.isBot ? " (AlphaBot)" : ""}
      </span>
    </div>
  );
}
