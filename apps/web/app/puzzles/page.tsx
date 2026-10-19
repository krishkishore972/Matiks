"use client";

import { Card, GameTile, InfoNote, Pill, ProgressBar, SectionTitle, StateBlock } from "../../components/ui";
import { Icon } from "../../components/icons";
import { DUEL_IDS, GAMES } from "../../lib/catalog";
import { PUZZLE_TABS } from "../../lib/services/backend";
import { usePlayer } from "../../lib/state/player";

export default function PuzzlesPage() {
  const { bundle, loading, error, purchase } = usePlayer();

  if (loading) return <StateBlock state="loading" title="Loading puzzles" />;
  if (error || !bundle) return <StateBlock state="error" message={error ?? "No player data."} />;

  const done = bundle.daily.completed;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-black tracking-tight text-ink-50">Puzzles</h1>
        <p className="mt-1 text-xs text-ink-400">
          Five daily boards seeded from today&apos;s date, plus an endless ladder that never runs out.
        </p>
      </section>

      <section className="animate-rise">
        <SectionTitle title="Daily Challenge" href="/daily" actionLabel="Open" />
        <div className="grid grid-cols-3 gap-3">
          {PUZZLE_TABS.daily.map((id) => (
            <GameTile
              key={id}
              href={`/play/${id}?daily=1`}
              icon={GAMES[id].icon}
              title={GAMES[id].title}
              meta={done.includes(id) ? "Done today" : `Min score ${GAMES[id].minScore}`}
              accent={GAMES[id].accent}
            />
          ))}
        </div>
        <div className="mt-3">
          <ProgressBar value={done.length / PUZZLE_TABS.daily.length} label="Daily progress" />
        </div>
      </section>

      <section className="animate-rise">
        <SectionTitle title="Snacc" actionLabel="" />
        <p className="mb-3 text-xs text-ink-400">
          Solve an endless stream of puzzles at your own pace. No timers, no pressure.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {PUZZLE_TABS.infinite.map((id) => (
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
        <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-300">
          <Icon name="SkipForward" className="h-3.5 w-3.5 text-lime-brand" />
          Snacc skips held: {bundle.wallet.skips}
          <button
            type="button"
            onClick={() => void purchase("snacc-skip")}
            className="ml-auto rounded-full bg-ink-800 px-3 py-1 font-semibold text-ink-100 hover:bg-ink-700"
          >
            Buy a skip (120 Pies)
          </button>
        </div>
        <p className="mt-2 text-[11px] text-ink-500">
          Don&apos;t feel like solving the puzzle? You can always skip by swiping up. You can skip only
          a limited number of puzzles per day; free skips reset tomorrow.
        </p>
      </section>

      <section className="animate-rise">
        <SectionTitle title="Skill duels" href="/compete" actionLabel="Compete" />
        <div className="grid grid-cols-3 gap-3">
          {DUEL_IDS.map((id) => (
            <GameTile
              key={id}
              href={`/play/${id}`}
              icon={GAMES[id].icon}
              title={GAMES[id].title}
              meta={GAMES[id].subtitle}
              accent={GAMES[id].accent}
            />
          ))}
        </div>
      </section>

      <section className="animate-rise space-y-3">
        <Card className="space-y-2">
          <p className="text-sm font-semibold text-ink-50">League divisions</p>
          <div className="flex flex-wrap gap-2">
            <Pill tone="lime">1st · 2000+</Pill>
            <Pill tone="sky">2nd · 1200+</Pill>
            <Pill tone="gold">3rd · 800+</Pill>
          </div>
          <p className="text-[11px] text-ink-400">
            Divisions are the ones named in the shipped app. Your own placement is derived from the rated
            score you have accumulated in this browser.
          </p>
        </Card>
        <InfoNote icon="Info">
          Boards are generated in the browser from a seeded RNG, so today&apos;s Daily Challenge is identical
          for every player on the same date — and reproducible for testing.
        </InfoNote>
      </section>
    </div>
  );
}
