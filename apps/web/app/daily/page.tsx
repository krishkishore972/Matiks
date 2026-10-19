"use client";

import Link from "next/link";
import { Card, InfoNote, Pill, ProgressBar, SectionTitle, StateBlock } from "../../components/ui";
import { Icon } from "../../components/icons";
import { GAMES } from "../../lib/catalog";
import { PUZZLE_TABS, todayKey } from "../../lib/services/backend";
import { usePlayer } from "../../lib/state/player";

export default function DailyPage() {
  const { bundle, loading, error, purchase } = usePlayer();

  if (loading) return <StateBlock state="loading" title="Loading today's challenge" />;
  if (error || !bundle) return <StateBlock state="error" message={error ?? "No player data."} />;

  const done = bundle.daily.completed;
  const complete = done.length === PUZZLE_TABS.daily.length;
  const skips = bundle.wallet.skips;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs text-ink-400">{todayKey()}</p>
        <h1 className="text-2xl font-black tracking-tight text-ink-50">Daily Challenge</h1>
        <p className="mt-1 text-xs text-ink-400">
          Finish all five puzzles to bank the day, keep your streak alive and earn Pies.
        </p>
      </section>

      <Card className="bg-gradient-to-br from-lime-brand/12 to-ink-900">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-ink-50">
              {done.length} of {PUZZLE_TABS.daily.length} complete
            </p>
            <p className="mt-0.5 text-xs text-ink-300">
              {complete ? "Today is in the bag. Nice." : "Every puzzle counts towards the streak trigger."}
            </p>
          </div>
          <Pill tone={complete ? "lime" : "neutral"} icon={complete ? "Check" : "Clock"}>
            {complete ? "Complete" : "In progress"}
          </Pill>
        </div>
        <div className="mt-3">
          <ProgressBar value={done.length / PUZZLE_TABS.daily.length} label="Daily progress" />
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-300">
          <Icon name="SkipForward" className="h-3.5 w-3.5 text-lime-brand" />
          Snacc Skips held: {skips}
          <button
            type="button"
            onClick={() => void purchase("snacc-skip")}
            className="ml-auto rounded-full bg-ink-800 px-3 py-1 font-semibold text-ink-100 hover:bg-ink-700"
          >
            Buy a skip (120 Pies)
          </button>
        </div>
      </Card>

      <section className="animate-rise">
        <SectionTitle title="Today's boards" actionLabel="" />
        <div className="grid grid-cols-2 gap-3">
          {PUZZLE_TABS.daily.map((id) => {
            const isDone = done.includes(id);
            return (
              <Link
                key={id}
                href={`/play/${id}?daily=1`}
                className="rounded-[18px] border border-ink-700/70 bg-ink-900 p-3 transition hover:border-lime-brand/50"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="grid h-9 w-9 place-items-center rounded-xl"
                    style={{ backgroundColor: `${GAMES[id].accent}22`, color: GAMES[id].accent }}
                  >
                    <Icon name={GAMES[id].icon} className="h-4.5 w-4.5" />
                  </span>
                  {isDone ? <Pill tone="lime" icon="Check">Done</Pill> : null}
                </div>
                <p className="mt-2 text-sm font-semibold text-ink-50">{GAMES[id].title}</p>
                <p className="text-xs text-ink-400">{GAMES[id].subtitle}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="animate-rise space-y-2">
        <SectionTitle title="How the day works" actionLabel="" />
        <InfoNote icon="Flame">
          Playing a duel, finishing the Daily Challenge, or joining a contest keeps your streak alive. Streak
          shields cost 200 Pies and you can hold at most two.
        </InfoNote>
        <InfoNote icon="Target">
          A play only counts when you beat the mode&apos;s minimum score ({GAMES.mindsnap.title} 60,{" "}
          {GAMES.flashanzan.title} 90, {GAMES.sprint.title} 10, and so on).
        </InfoNote>
      </section>
    </div>
  );
}
