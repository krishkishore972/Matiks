"use client";

import Link from "next/link";
import { Card, InfoNote, Pill, SectionTitle, StateBlock } from "../../components/ui";
import { Icon } from "../../components/icons";
import { DUEL_IDS, GAMES } from "../../lib/catalog";
import { simulateOpponent } from "../../lib/services/backend";
import { isServerBacked } from "../../lib/services/backend";
import { usePlayer } from "../../lib/state/player";

/**
 * Contests are announced in the shipped app (80 in 8, Survival Saturday, Speed
 * Run, Road to Kolkata) but need a live server. They are listed here as the
 * interface the app exposes, with an honest "needs the server" state; the
 * offline practice link runs the same format locally.
 */
const CONTESTS = [
  {
    id: "80-in-8",
    title: "80 in 8",
    blurb: "Clear 80 sprint boards inside 8 minutes.",
    format: "60-second sprint rules, longer clock, higher target.",
    icon: "Timer",
    accent: "#ffc53d",
  },
  {
    id: "survival-saturday",
    title: "Survival Saturday",
    blurb: "+3s for a correct answer, −20s for a mistake.",
    format: "One clock, brutal penalties.",
    icon: "Flame",
    accent: "#ff4d6d",
  },
  {
    id: "speed-run",
    title: "Speed Run",
    blurb: "Fastest clear of a fixed ladder of boards.",
    format: "Ranked on time, not score.",
    icon: "Zap",
    accent: "#b1fa63",
  },
  {
    id: "road-to-kolkata",
    title: "Road to Kolkata",
    blurb: "A season-long ladder with a city finale.",
    format: "Seasonal progression.",
    icon: "Award",
    accent: "#9d7bff",
  },
];

export default function CompetePage() {
  const { bundle, loading, error } = usePlayer();

  if (loading) return <StateBlock state="loading" title="Loading the arena" />;
  if (error || !bundle) return <StateBlock state="error" message={error ?? "No player data."} />;

  const ladder = bundle.ratings;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-black tracking-tight text-ink-50">Compete</h1>
        <p className="mt-1 text-xs text-ink-400">
          {isServerBacked()
            ? "Every duel runs for 60 seconds. Sprint, Fastest Finger and DMAS can be played live against another player; the rest practise against a simulated rival."
            : "Every duel runs for 60 seconds against a simulated rival, because no game server is configured."}
        </p>
      </section>

      <section className="animate-rise">
        <SectionTitle title="Duels" actionLabel="" />
        <div className="space-y-2">
          {DUEL_IDS.map((id) => {
            const meta = GAMES[id];
            const opponent = simulateOpponent(id);
            const rating = ladder.find((entry) => entry.gameId === id);
            return (
              <Link
                key={id}
                href={`/play/${id}`}
                className="flex items-center gap-3 rounded-2xl border border-ink-700/70 bg-ink-900 p-3 transition hover:border-lime-brand/50"
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                  style={{ backgroundColor: `${meta.accent}22`, color: meta.accent }}
                >
                  <Icon name={meta.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink-50">{meta.title}</span>
                  <span className="block truncate text-xs text-ink-400">{meta.subtitle}</span>
                </span>
                <span className="text-right">
                  <span className="tabular block text-sm font-bold text-ink-100">
                    {rating ? rating.rating : 1200}
                  </span>
                  <span className="block text-[10px] text-ink-400">
                    vs {opponent.name} · {opponent.score}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="animate-rise space-y-2">
        <SectionTitle title="Contests" actionLabel="" />
        {CONTESTS.map((contest) => (
          <Card key={contest.id} className="flex items-start gap-3">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{ backgroundColor: `${contest.accent}22`, color: contest.accent }}
            >
              <Icon name={contest.icon} className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-ink-50">{contest.title}</p>
                <Pill tone="danger" icon="Lock">
                  Needs server
                </Pill>
              </div>
              <p className="mt-0.5 text-xs text-ink-300">{contest.blurb}</p>
              <p className="mt-0.5 text-[11px] text-ink-400">{contest.format}</p>
              <Link
                href="/play/sprint"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-lime-brand"
              >
                Practice the format offline
                <Icon name="ChevronRight" className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        ))}
        <InfoNote icon="Info">
          Live contests pair real players on a schedule. Without a backend this build can only show the
          interface and let you rehearse the format, so nothing here pretends to be a live bracket.
        </InfoNote>
      </section>

      <section className="animate-rise space-y-2">
        <SectionTitle title="Your ladder" actionLabel="" />
        <Card className="space-y-2">
          {ladder.length === 0 ? (
            <p className="text-xs text-ink-400">No rated games yet — play a duel to place yourself.</p>
          ) : (
            ladder.map((entry) => (
              <div key={entry.gameId} className="flex items-center justify-between text-sm">
                <span className="text-ink-200">{GAMES[entry.gameId]?.title ?? entry.gameId}</span>
                <span className="tabular text-ink-50">
                  {entry.rating}
                  <span className="ml-2 text-[10px] text-ink-400">
                    {entry.games} games · best {entry.bestScore}
                  </span>
                </span>
              </div>
            ))
          )}
        </Card>
      </section>
    </div>
  );
}
