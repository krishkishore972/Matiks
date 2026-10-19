"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, GameTile, InfoNote, Pill, ProgressBar, SectionTitle, StatBlock, StateBlock } from "../components/ui";
import { Icon } from "../components/icons";
import { DUEL_IDS, GAMES, INFINITE_PUZZLE_IDS } from "../lib/catalog";
import { getBackend, PUZZLE_TABS } from "../lib/services/backend";
import type { LeaderboardEntry } from "../lib/types";
import { usePlayer } from "../lib/state/player";
import { formatPercent } from "../lib/utils/cn";

export default function HomePage() {
  const { bundle, loading, error, reload } = usePlayer();
  const [board, setBoard] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getBackend()
      .leaderboard("global", "xp")
      .then((entries) => {
        if (!cancelled) setBoard(entries);
      })
      .catch(() => {
        if (!cancelled) setBoard([]);
      });
    return () => {
      cancelled = true;
    };
  }, [bundle?.stats.xp]);

  if (loading) {
    return <StateBlock state="loading" title="Loading your arena" message="Reading local progress…" />;
  }

  if (error || !bundle) {
    return (
      <StateBlock
        state="error"
        message={error ?? "Player data could not be loaded."}
        action={{ label: "Try again", onClick: () => void reload() }}
      />
    );
  }

  const { profile, stats, level, streak, daily } = bundle;
  const played = stats.gamesPlayed;
  const accuracy = played === 0 ? 0 : stats.gamesSolved / played;
  const dailyDone = daily.completed.length;
  const playerRank = board?.find((entry) => entry.isCurrentPlayer)?.rank ?? null;
  const myRating = bundle.ratings.find((record) => record.gameId === "sprint");

  return (
    <div className="space-y-6">
      <section className="animate-rise">
        <p className="text-xs text-ink-400">Welcome back</p>
        <h1 className="text-2xl font-black tracking-tight text-ink-50">{profile.displayName}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Pill icon="Star" tone="lime">
            Level {level.level}
          </Pill>
          {myRating ? (
            <Pill icon="Timer" tone="gold">
              Sprint {myRating.rating}
            </Pill>
          ) : (
            <Pill icon="Sparkles" tone="sky">
              New player
            </Pill>
          )}
          {profile.isPro ? <Pill icon="Crown" tone="violet">Pro</Pill> : null}
        </div>
        <div className="mt-3">
          <ProgressBar value={level.progress} label="Level progress" />
          <p className="mt-1 text-[11px] text-ink-400">
            {level.intoLevel} / {level.levelSpan} XP to level {level.level + 1}
          </p>
        </div>
      </section>

      <section className="animate-rise">
        <Card className="bg-gradient-to-br from-lime-brand/15 to-ink-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-lime-brand uppercase">Streak</p>
              <p className="tabular mt-1 text-3xl font-black text-ink-50">{streak.current} days</p>
              <p className="mt-1 text-xs text-ink-300">
                Best {streak.best} · {streak.shields} shield{streak.shields === 1 ? "" : "s"} held
              </p>
            </div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-brand/20 text-lime-brand">
              <Icon name="Flame" className="h-6 w-6" />
            </span>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-300">
            Play a duel, finish the Daily Challenge or join a contest to keep it alive.
          </p>
        </Card>
      </section>

      <section className="animate-rise">
        <SectionTitle title="Daily Challenge" href="/daily" actionLabel="Open" />
        <Link href="/daily" className="block">
          <Card className="transition hover:border-lime-brand/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink-50">
                  {dailyDone} of {PUZZLE_TABS.daily.length} puzzles done
                </p>
                <p className="mt-0.5 text-xs text-ink-300">
                  Same five boards for everyone, seeded from today&apos;s date.
                </p>
              </div>
              <Icon name="ChevronRight" className="h-5 w-5 text-ink-400" />
            </div>
            <div className="mt-3">
              <ProgressBar value={dailyDone / PUZZLE_TABS.daily.length} label="Daily challenge progress" />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {PUZZLE_TABS.daily.map((id) => {
                const done = daily.completed.includes(id);
                return (
                  <Pill key={id} tone={done ? "lime" : "neutral"} icon={done ? "Check" : undefined}>
                    {GAMES[id].title}
                  </Pill>
                );
              })}
            </div>
          </Card>
        </Link>
      </section>

      <section className="animate-rise">
        <SectionTitle title="Quick duels" href="/compete" actionLabel="All modes" />
        <div className="grid grid-cols-3 gap-3">
          {DUEL_IDS.slice(0, 6).map((id) => (
            <GameTile
              key={id}
              href={`/play/${id}`}
              icon={GAMES[id].icon}
              title={GAMES[id].title}
              meta={GAMES[id].category}
              accent={GAMES[id].accent}
            />
          ))}
        </div>
      </section>

      <section className="animate-rise">
        <SectionTitle title="Infinite puzzles" href="/puzzles" actionLabel="All puzzles" />
        <div className="grid grid-cols-3 gap-3">
          {INFINITE_PUZZLE_IDS.map((id) => (
            <GameTile
              key={id}
              href={`/play/${id}`}
              icon={GAMES[id].icon}
              title={GAMES[id].title}
              meta="Endless"
              accent={GAMES[id].accent}
            />
          ))}
        </div>
      </section>

      <section className="animate-rise">
        <SectionTitle title="Your insights" href="/profile" actionLabel="Profile" />
        <div className="grid grid-cols-3 gap-3">
          <StatBlock label="Games" value={`${played}`} icon="Play" />
          <StatBlock label="Accuracy" value={formatPercent(accuracy)} icon="Target" tone="#b1fa63" />
          <StatBlock label="Perfect" value={`${stats.perfectRuns}`} icon="Award" tone="#ffc53d" />
        </div>
      </section>

      <section className="animate-rise">
        <SectionTitle title="XP leaderboard" href="/leaderboard" actionLabel="Full board" />
        <Card className="space-y-2">
          {board === null ? (
            <p className="text-xs text-ink-400">Loading board…</p>
          ) : board.length === 0 ? (
            <p className="text-xs text-ink-400">No entries yet.</p>
          ) : (
            board.slice(0, 4).map((entry) => (
              <div
                key={entry.playerId}
                className={`flex items-center justify-between rounded-xl px-2 py-1.5 ${
                  entry.isCurrentPlayer ? "bg-lime-brand/10" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="tabular w-5 text-xs text-ink-400">#{entry.rank}</span>
                  <span className="text-sm text-ink-100">{entry.displayName}</span>
                  {entry.simulated ? (
                    <span className="rounded-full bg-ink-800 px-1.5 py-0.5 text-[9px] text-ink-400">bot</span>
                  ) : null}
                </div>
                <span className="tabular text-sm font-semibold text-ink-50">
                  {entry.score.toLocaleString()}
                </span>
              </div>
            ))
          )}
          {playerRank ? (
            <p className="text-[11px] text-ink-400">
              You are #{playerRank} today. Rows marked “bot” are simulated practice rivals — there is no live
              server in this build.
            </p>
          ) : null}
        </Card>
      </section>

      <section className="animate-rise space-y-2">
        <SectionTitle title="Snacc" href="/store" actionLabel="Open store" />
        <InfoNote icon="Gift">
          Streak shields, Snacc skips and XP boosters are bought with Pies, the soft currency earned by
          finishing boards above the minimum score.
        </InfoNote>
      </section>
    </div>
  );
}
