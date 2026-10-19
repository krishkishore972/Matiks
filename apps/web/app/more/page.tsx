"use client";

import Link from "next/link";
import { Button, Card, InfoNote, Pill, ProgressBar, SectionTitle, StateBlock } from "../../components/ui";
import { Icon } from "../../components/icons";
import { isServerBacked } from "../../lib/services/backend";
import { usePlayer } from "../../lib/state/player";
import { formatPercent } from "../../lib/utils/cn";

const LINKS = [
  { href: "/profile", label: "Profile & statistics", icon: "User", hint: "Ratings, history, insights" },
  { href: "/leaderboard", label: "Leaderboards", icon: "Trophy", hint: "Global, friends, college" },
  { href: "/store", label: "Pi Store", icon: "Store", hint: "Pies, shields, boosters" },
  { href: "/puzzles", label: "Puzzles", icon: "Puzzle", hint: "Daily and infinite" },
  { href: "/compete", label: "Compete", icon: "Swords", hint: "Duels and contests" },
  { href: "/quests", label: "Quests", icon: "Target", hint: "Daily objectives" },
];

export default function MorePage() {
  const { bundle, loading, error, reset } = usePlayer();

  if (loading) return <StateBlock state="loading" title="Loading your profile" />;
  if (error || !bundle) return <StateBlock state="error" message={error ?? "No player data."} />;

  const { profile, stats, level, streak } = bundle;
  const accuracy = stats.gamesPlayed === 0 ? 0 : stats.gamesSolved / stats.gamesPlayed;

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-ink-800 to-ink-900">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink-850 text-2xl font-black text-lime-brand">
            {profile.displayName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-ink-50">{profile.displayName}</p>
            <p className="text-xs text-ink-400">
              @{profile.handle} · {profile.country}
              {profile.college ? ` · ${profile.college}` : ""}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Pill tone="lime" icon="Star">Level {level.level}</Pill>
              <Pill tone="gold" icon="Flame">{streak.current} day streak</Pill>
              {profile.isPro ? <Pill tone="violet" icon="Crown">Pro</Pill> : null}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar value={level.progress} label="Level progress" />
          <p className="mt-1 text-[11px] text-ink-400">
            {level.intoLevel} / {level.levelSpan} XP · {stats.xp.toLocaleString()} total · {formatPercent(accuracy)} accuracy
          </p>
        </div>
      </Card>

      <section className="animate-rise space-y-2">
        <SectionTitle title="Go to" actionLabel="" />
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-3 rounded-2xl border border-ink-700/70 bg-ink-900 p-3 transition hover:border-lime-brand/50"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-800 text-lime-brand">
              <Icon name={link.icon} className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink-50">{link.label}</span>
              <span className="block text-xs text-ink-400">{link.hint}</span>
            </span>
            <Icon name="ChevronRight" className="h-4 w-4 text-ink-500" />
          </Link>
        ))}
      </section>

      <section className="animate-rise space-y-2">
        <SectionTitle title="About this build" actionLabel="" />
        <InfoNote icon="Info">
          A web recreation of Matiks, reverse engineered from the shipped Android 1.51.0 build. Game rules,
          copy, minimum scores and design tokens come from that artifact; anything that is inferred is called
          out in docs/reference-analysis.md.
        </InfoNote>
        <InfoNote icon="Users">
          {isServerBacked()
            ? "Sprint, Fastest Finger and DMAS duel real players through the game server; when nobody is waiting, the server seats the AlphaBot, and those rows stay labelled. Other modes practise against a labelled simulated rival."
            : "Duels and leaderboards use simulated opponents because no game server is configured. They are labelled as simulated everywhere they appear."}
        </InfoNote>
        <Button variant="danger" fullWidth icon="RotateCcw" onClick={() => void reset()}>
          Reset local progress
        </Button>
      </section>
    </div>
  );
}
