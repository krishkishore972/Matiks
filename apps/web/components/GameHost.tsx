"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GAMES } from "../lib/catalog";
import { generateCrossMath, type CrossMathPuzzle } from "../lib/games/crossmath";
import { generateHectoc, type HectocPuzzle } from "../lib/games/hectoc";
import { generateKenKen, type KenKenPuzzle } from "../lib/games/kenken";
import { generateMathMaze, type MathMazePuzzle } from "../lib/games/mathmaze";
import { generatePipes, type PipesPuzzle } from "../lib/games/pipes";
import { generateQueens, type QueensPuzzle } from "../lib/games/queens";
import { generateSudoku, type SudokuPuzzle } from "../lib/games/sudoku";
import { generateTango, type TangoPuzzle } from "../lib/games/tango";
import { generateWend, type WendPuzzle } from "../lib/games/wend";
import { generateZip, type ZipPuzzle } from "../lib/games/zip";
import { useGameSession } from "../lib/hooks/useGameSession";
import { createRng } from "../lib/rng";
import {
  blitzShape,
  BLITZ_SHAPE_NOTE,
  QUALITY_BAND_LABEL,
  scorePuzzle,
} from "../lib/scoring";
import {
  dailySeed,
  practiceSeed,
  simulateOpponent,
  todayKey,
  type RecordOutcome,
} from "../lib/services/backend";
import { usePlayer } from "../lib/state/player";
import type { BlitzShape, Difficulty, GameId, GameResult } from "../lib/types";
import { cn, formatDuration, formatPercent } from "../lib/utils/cn";
import { isServerBacked } from "../lib/services/backend";
import { LiveDuel } from "./LiveDuel";
import { ArithmeticDuel } from "./games/ArithmeticDuel";
import { CrossMathBoard } from "./games/CrossMathBoard";
import { FlashAnzanDuel } from "./games/FlashAnzanDuel";
import { HectocBoard } from "./games/HectocBoard";
import { KenKenBoard } from "./games/KenKenBoard";
import { MathMazeBoard } from "./games/MathMazeBoard";
import { MindSnapDuel } from "./games/MindSnapDuel";
import { PinBallDuel } from "./games/PinBallDuel";
import { PipesBoard } from "./games/PipesBoard";
import { QueensBoard } from "./games/QueensBoard";
import { SudokuBoard } from "./games/SudokuBoard";
import { SumOfSquaresDuel } from "./games/SumOfSquaresDuel";
import { TangoBoard } from "./games/TangoBoard";
import { WendBoard } from "./games/WendBoard";
import { ZipBoard } from "./games/ZipBoard";
import { Button, Card, InfoNote, Modal, Pill, StateBlock } from "./ui";
import { Icon } from "./icons";

const DUEL_DURATION_MS = 60_000;
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "expert"];
const EXPECTED_MS: Record<Difficulty, number> = {
  easy: 90_000,
  medium: 150_000,
  hard: 240_000,
  expert: 360_000,
};

type ActivePuzzle =
  | { game: "sudoku"; data: SudokuPuzzle }
  | { game: "kenken"; data: KenKenPuzzle }
  | { game: "crossmath"; data: CrossMathPuzzle }
  | { game: "mathmaze"; data: MathMazePuzzle }
  | { game: "hectoc"; data: HectocPuzzle }
  | { game: "queens"; data: QueensPuzzle }
  | { game: "tango"; data: TangoPuzzle }
  | { game: "zip"; data: ZipPuzzle }
  | { game: "pipes"; data: PipesPuzzle }
  | { game: "wend"; data: WendPuzzle };

const DAILY_DIFFICULTY_GAMES: GameId[] = ["sudoku", "kenken", "crossmath", "mathmaze", "hectoc"];

/**
 * Modes the server can referee question-by-question. The memory duels generate
 * their boards on-device, so they stay practice-only until that generation moves
 * behind the API as well.
 */
const LIVE_DUEL_IDS: GameId[] = ["sprint", "fastestfinger", "dmas"];

/**
 * Blitz duels run 60 seconds and are read as three 20-second windows. The
 * opponent's points are spread across the same windows deterministically so the
 * shape is stable for a given day and opponent.
 */
function windowsFromScore(seedKey: string, total: number): [number, number, number] {
  const rng = createRng(seedKey);
  const weights = [0.3 + rng.next() * 0.4, 0.3 + rng.next() * 0.4, 0.3 + rng.next() * 0.4];
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((weight) => Math.round((weight / sum) * total)) as [number, number, number];
}

function buildPuzzle(gameId: GameId, seed: string, difficulty: Difficulty): ActivePuzzle | null {
  switch (gameId) {
    case "sudoku":
      return { game: "sudoku", data: generateSudoku(seed, difficulty) };
    case "kenken":
      return { game: "kenken", data: generateKenKen(seed, difficulty) };
    case "crossmath":
      return { game: "crossmath", data: generateCrossMath(seed, difficulty) };
    case "mathmaze":
      return { game: "mathmaze", data: generateMathMaze(seed, difficulty) };
    case "hectoc":
      return { game: "hectoc", data: generateHectoc(seed, difficulty) };
    case "queens":
      return { game: "queens", data: generateQueens(seed) };
    case "tango":
      return { game: "tango", data: generateTango(seed) };
    case "zip":
      return { game: "zip", data: generateZip(seed) };
    case "pipes":
      return { game: "pipes", data: generatePipes(seed) };
    case "wend":
      return { game: "wend", data: generateWend(seed) };
    default:
      return null;
  }
}

export function GameHost({ gameId, daily = false }: { gameId: GameId; daily?: boolean }) {
  const meta = GAMES[gameId];
  const session = useGameSession();
  const { record, bundle } = usePlayer();

  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [nonce, setNonce] = useState(0);
  const [puzzle, setPuzzle] = useState<ActivePuzzle | null>(null);
  const [seed, setSeed] = useState<string>(() => (daily ? dailySeed(todayKey(), gameId) : practiceSeed(gameId, 0)));
  const [outcome, setOutcome] = useState<RecordOutcome | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shape, setShape] = useState<{ shape: BlitzShape; note: string; lead: number } | null>(null);
  const [live, setLive] = useState(false);
  const windowMarks = useRef<number[]>([]);

  const isDuel = !meta.daily && !["queens", "tango", "zip", "pipes", "wend"].includes(gameId);
  const canPlayLive = LIVE_DUEL_IDS.includes(gameId) && isServerBacked();

  const opponent = useMemo(
    () => (isDuel ? simulateOpponent(gameId) : null),
    [isDuel, gameId],
  );

  const level: number = useMemo(() => {
    const rating = bundle?.ratings.find((entry) => entry.gameId === gameId)?.rating ?? 1200;
    return Math.max(1, Math.min(5, Math.round((rating - 900) / 100)));
  }, [bundle?.ratings, gameId]);

  const isDailyPuzzle = DAILY_DIFFICULTY_GAMES.includes(gameId);

  // Record how many points were banked by the 20s and 40s marks.
  useEffect(() => {
    if (!isDuel || !session.running) return;
    const marks = windowMarks.current;
    if (session.elapsedMs >= 20_000 && marks.length === 0) marks.push(session.correct);
    if (session.elapsedMs >= 40_000 && marks.length === 1) marks.push(session.correct);
  }, [isDuel, session.running, session.elapsedMs, session.correct]);

  const recordResult = useCallback(
    async (params: {
      score: number;
      solved: boolean;
      detail?: Record<string, number | string | boolean>;
      durationMs: number;
      opponentScore?: number;
    }) => {
      try {
        const result: GameResult = {
          gameId,
          score: params.score,
          durationMs: params.durationMs,
          accuracy: session.accuracy,
          solved: params.solved,
          detail: params.detail,
          at: new Date().toISOString(),
        };
        const next = await record({
          result,
          difficulty,
          expectedMs: EXPECTED_MS[difficulty],
          isDaily: daily,
          opponentScore: params.opponentScore,
        });
        setOutcome(next);
        setShowResult(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save that result.");
      } finally {
        setBusy(false);
      }
    },
    [gameId, record, session.accuracy, difficulty, daily],
  );

  const start = useCallback(() => {
    setError(null);
    setOutcome(null);
    setShowResult(false);
    setShape(null);
    windowMarks.current = [];
    const nextSeed = daily
      ? dailySeed(todayKey(), gameId)
      : practiceSeed(gameId, nonce);
    setSeed(nextSeed);

    if (!isDuel) {
      const built = buildPuzzle(gameId, nextSeed, difficulty);
      if (!built) {
        setError("That mode could not be generated. Try another difficulty.");
        return;
      }
      setPuzzle(built);
    } else {
      setPuzzle(null);
    }
    session.start();
  }, [daily, difficulty, gameId, isDuel, nonce, session]);

  const handleSolved = useCallback(
    (detail?: Record<string, number | string | boolean>) => {
      if (busy) return;
      setBusy(true);
      const durationMs = session.elapsedMs || 1;
      session.finish();
      const points = typeof detail?.points === "number" ? detail.points : null;
      const score =
        points !== null
          ? points
          : scorePuzzle({
              difficulty,
              solved: true,
              accuracy: session.accuracy,
              durationMs,
            });

      if (isDuel && opponent) {
        const total = session.correct;
        const marks = windowMarks.current;
        const c0 = marks[0] ?? total;
        const c1 = marks[1] ?? total;
        const opponentWindows = windowsFromScore(
          `${gameId}:${todayKey()}:windows`,
          opponent.score,
        );
        const verdict = blitzShape([
          { player: c0, opponent: opponentWindows[0] },
          { player: Math.max(0, c1 - c0), opponent: opponentWindows[1] },
          { player: Math.max(0, total - c1), opponent: opponentWindows[2] },
        ]);
        setShape({ shape: verdict.shape, note: BLITZ_SHAPE_NOTE[verdict.shape], lead: verdict.leadAtEnd });
      }

      void recordResult({ score, solved: true, detail, durationMs, opponentScore: opponent?.score });
    },
    [busy, difficulty, gameId, isDuel, opponent, recordResult, session],
  );

  const giveUp = useCallback(() => {
    if (busy) return;
    setBusy(true);
    session.finish();
    void recordResult({
      score: 0,
      solved: false,
      durationMs: session.elapsedMs || 1,
      opponentScore: opponent?.score,
    });
  }, [busy, opponent?.score, recordResult, session]);

  if (!bundle) {
    return <StateBlock state="loading" title="Warming up" message="Preparing your session…" />;
  }

  if (live) {
    return <LiveDuel gameId={gameId} onExit={() => setLive(false)} />;
  }

  const playing = session.status === "playing";

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <Link href={daily ? "/daily" : "/puzzles"} className="flex items-center gap-1 text-sm text-ink-300">
          <Icon name="ArrowLeft" className="h-4 w-4" />
          Back
        </Link>
        <div className="flex items-center gap-2">
          <Pill icon="Clock" tone="neutral">
            {formatDuration(session.elapsedMs)}
          </Pill>
          <Pill icon="Target" tone={session.mistakes === 0 ? "lime" : "danger"}>
            {formatPercent(session.accuracy)}
          </Pill>
        </div>
      </header>

      <div>
        <h1 className="text-xl font-black tracking-tight text-ink-50">{meta.title}</h1>
        <p className="text-xs text-ink-400">
          {meta.subtitle}
          {daily ? " · today's Daily Challenge board" : ""}
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-berry/15 px-3 py-2 text-xs font-semibold text-berry">{error}</p>
      ) : null}

      {session.status === "ready" ? (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="lime" icon="Target">
              Min score {meta.minScore}
            </Pill>
            <Pill tone="sky" icon="Sparkles">
              {isDuel ? "60-second duel" : `${EXPECTED_MS[difficulty] / 1000}s par`}
            </Pill>
            {opponent ? <Pill tone="violet" icon="Users">{opponent.name}</Pill> : null}
          </div>

          <ol className="space-y-2">
            {meta.howToPlay.map((step, index) => (
              <li key={step} className="flex gap-2 text-xs leading-relaxed text-ink-200">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-ink-800 text-[10px] font-bold text-lime-brand">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          {isDailyPuzzle ? (
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDifficulty(option)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition",
                    difficulty === option ? "bg-lime-brand text-lime-ink" : "bg-ink-800 text-ink-200",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}

          {opponent ? (
            <InfoNote icon="Info">
              {canPlayLive
                ? `Practice alone uses a simulated rival (${opponent.name}, rating ${opponent.rating}). Choose "Find a live opponent" to duel a real player through the game server.`
                : `Your rival here is simulated (${opponent.name}, rating ${opponent.rating}) because this mode's board is generated on-device. The result is still scored and saved.`}
            </InfoNote>
          ) : null}

          {canPlayLive ? (
            <>
              <Button fullWidth icon="Users" onClick={() => setLive(true)}>
                Find a live opponent
              </Button>
              <Button fullWidth variant="secondary" icon="Play" onClick={start}>
                Practice alone
              </Button>
            </>
          ) : (
            <Button fullWidth icon="Play" onClick={start}>
              {session.mistakes > 0 || session.elapsedMs > 0 ? "Start again" : "Start"}
            </Button>
          )}
        </Card>
      ) : null}

      {playing && puzzle?.game === "sudoku" ? (
        <SudokuBoard puzzle={puzzle.data} session={session} onSolved={handleSolved} />
      ) : null}
      {playing && puzzle?.game === "kenken" ? (
        <KenKenBoard puzzle={puzzle.data} session={session} onSolved={handleSolved} />
      ) : null}
      {playing && puzzle?.game === "crossmath" ? (
        <CrossMathBoard puzzle={puzzle.data} session={session} onSolved={handleSolved} />
      ) : null}
      {playing && puzzle?.game === "mathmaze" ? (
        <MathMazeBoard puzzle={puzzle.data} session={session} onSolved={handleSolved} />
      ) : null}
      {playing && puzzle?.game === "hectoc" ? (
        <HectocBoard puzzle={puzzle.data} session={session} onSolved={handleSolved} />
      ) : null}
      {playing && puzzle?.game === "queens" ? (
        <QueensBoard puzzle={puzzle.data} session={session} onSolved={handleSolved} />
      ) : null}
      {playing && puzzle?.game === "tango" ? (
        <TangoBoard puzzle={puzzle.data} session={session} onSolved={handleSolved} />
      ) : null}
      {playing && puzzle?.game === "zip" ? (
        <ZipBoard puzzle={puzzle.data} session={session} onSolved={handleSolved} />
      ) : null}
      {playing && puzzle?.game === "pipes" ? (
        <PipesBoard puzzle={puzzle.data} session={session} onSolved={handleSolved} />
      ) : null}
      {playing && puzzle?.game === "wend" ? (
        <WendBoard puzzle={puzzle.data} session={session} onSolved={handleSolved} />
      ) : null}

      {playing && gameId === "sprint" ? (
        <ArithmeticDuel mode="sprint" seed={seed} level={level} durationMs={DUEL_DURATION_MS} session={session} onSolved={handleSolved} />
      ) : null}
      {playing && gameId === "fastestfinger" ? (
        <ArithmeticDuel mode="fastestfinger" seed={seed} level={level} durationMs={DUEL_DURATION_MS} session={session} onSolved={handleSolved} />
      ) : null}
      {playing && gameId === "dmas" ? (
        <ArithmeticDuel mode="dmas" seed={seed} level={level} durationMs={DUEL_DURATION_MS} session={session} onSolved={handleSolved} />
      ) : null}
      {playing && gameId === "mindsnap" ? (
        <MindSnapDuel seed={seed} durationMs={DUEL_DURATION_MS} session={session} onSolved={handleSolved} />
      ) : null}
      {playing && gameId === "flashanzan" ? (
        <FlashAnzanDuel seed={seed} session={session} onSolved={handleSolved} />
      ) : null}
      {playing && gameId === "pinballrecall" ? (
        <PinBallDuel seed={seed} session={session} onSolved={handleSolved} />
      ) : null}
      {playing && gameId === "sumofsquares" ? (
        <SumOfSquaresDuel seed={seed} durationMs={DUEL_DURATION_MS} session={session} onSolved={handleSolved} />
      ) : null}

      {playing ? (
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth icon="RotateCcw" onClick={giveUp}>
            End attempt
          </Button>
        </div>
      ) : null}

      {playing && isDuel ? (
        <p className="text-[11px] text-ink-400">
          Accuracy {formatPercent(session.accuracy)} · {session.correct} correct · {session.mistakes} mistakes.
          The clock stops at 60 seconds and your score is banked automatically.
        </p>
      ) : null}

      <Modal open={showResult} onClose={() => setShowResult(false)} title="Attempt summary">
        {outcome ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-ink-400">{meta.title}</p>
                <p className="tabular text-3xl font-black text-lime-brand">{outcome.score}</p>
              </div>
              <Pill tone={outcome.counted ? "lime" : "danger"} icon={outcome.counted ? "Check" : "CircleAlert"}>
                {outcome.counted ? "Counts towards quests" : `Below min score ${meta.minScore}`}
              </Pill>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-ink-800/60 p-2.5">
                <p className="text-[10px] text-ink-400 uppercase">Quality band</p>
                <p className="text-sm font-bold text-ink-50">{outcome.band}</p>
                <p className="mt-0.5 text-[10px] text-ink-400">{QUALITY_BAND_LABEL[outcome.band]}</p>
              </div>
              <div className="rounded-xl bg-ink-800/60 p-2.5">
                <p className="text-[10px] text-ink-400 uppercase">Accuracy</p>
                <p className="text-sm font-bold text-ink-50">{formatPercent(session.accuracy)}</p>
                <p className="mt-0.5 text-[10px] text-ink-400">{session.mistakes} mistakes counted</p>
              </div>
              <div className="rounded-xl bg-ink-800/60 p-2.5">
                <p className="text-[10px] text-ink-400 uppercase">Rating</p>
                <p className="tabular text-sm font-bold text-ink-50">
                  {outcome.ratingBefore} → {outcome.ratingAfter}{" "}
                  <span className={outcome.ratingChange >= 0 ? "text-lime-brand" : "text-berry"}>
                    ({outcome.ratingChange >= 0 ? "+" : ""}
                    {outcome.ratingChange})
                  </span>
                </p>
              </div>
              <div className="rounded-xl bg-ink-800/60 p-2.5">
                <p className="text-[10px] text-ink-400 uppercase">XP</p>
                <p className="tabular text-sm font-bold text-ink-50">+{outcome.xpGained}</p>
                <p className="mt-0.5 text-[10px] text-ink-400">
                  {outcome.levelBefore} → {outcome.levelAfter}
                  {outcome.leveledUp ? " · level up!" : ""}
                </p>
              </div>
            </div>

            {outcome.won !== null && outcome.dualedOpponentScore !== null ? (
              <div className="rounded-xl bg-ink-800/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-ink-100">
                    {outcome.won ? "You beat the simulated rival" : "The simulated rival edged it"}:{" "}
                    {outcome.score} vs {outcome.dualedOpponentScore}
                  </p>
                  {shape ? <Pill tone={outcome.won ? "lime" : "danger"}>{shape.shape}</Pill> : null}
                </div>
                <p className="mt-1 text-[10px] text-ink-400">
                  {shape ? shape.note : "Blitz shape is read from the lead across three 20-second windows."}
                </p>
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-xl bg-ink-800/60 p-3">
              <span className="text-xs text-ink-300">Streak</span>
              <span className="tabular text-sm font-bold text-lime-brand">
                {outcome.streak.current} days (best {outcome.streak.best})
              </span>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setNonce((current) => current + 1);
                  session.reset();
                  setPuzzle(null);
                  setOutcome(null);
                  setShowResult(false);
                }}
              >
                Play again
              </Button>
              <Link
                href="/"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-lime-brand px-4 py-2.5 text-sm font-semibold text-lime-ink transition active:scale-[0.98]"
              >
                <Icon name="Home" className="h-4 w-4" />
                Home
              </Link>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
