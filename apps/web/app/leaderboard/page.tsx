"use client";

import { useEffect, useState } from "react";
import { InfoNote, Pill, SectionTitle, StateBlock } from "../../components/ui";
import { cn } from "../../lib/utils/cn";
import {
  getBackend,
  type Backend,
} from "../../lib/services/backend";
import {
  LEADERBOARD_CATEGORIES,
  LEADERBOARD_SCOPES,
  type LeaderboardCategory,
} from "../../lib/services/leaderboard";
import type { LeaderboardEntry, LeaderboardScope } from "../../lib/types";
import { usePlayer } from "../../lib/state/player";

export default function LeaderboardPage() {
  const { bundle } = usePlayer();
  const [scope, setScope] = useState<LeaderboardScope>("global");
  const [category, setCategory] = useState<LeaderboardCategory>("xp");
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const backend: Backend = getBackend();
    backend
      .leaderboard(scope, category)
      .then((rows) => {
        if (!cancelled) {
          setEntries(rows);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load the board.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, category, bundle?.stats.xp]);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-black tracking-tight text-ink-50">Leaderboard</h1>
        <p className="mt-1 text-xs text-ink-400">
          Global, friends and college scopes across the app&apos;s five leaderboard categories.
        </p>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {LEADERBOARD_SCOPES.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setScope(option.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition",
              scope === option.id ? "bg-lime-brand text-lime-ink" : "bg-ink-800 text-ink-200",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {LEADERBOARD_CATEGORIES.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setCategory(option.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition",
              category === option.id ? "bg-ink-700 text-lime-brand" : "bg-ink-800/60 text-ink-300",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <StateBlock state="loading" title="Reading the board" />
      ) : error ? (
        <StateBlock state="error" message={error} />
      ) : !entries || entries.length === 0 ? (
        <StateBlock state="empty" message="No entries in this scope yet." />
      ) : (
        <section className="space-y-1.5">
          <SectionTitle title={`${LEADERBOARD_SCOPES.find((s) => s.id === scope)?.label} · ${LEADERBOARD_CATEGORIES.find((c) => c.id === category)?.label}`} actionLabel="" />
          {entries.map((entry) => (
            <div
              key={entry.playerId}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2",
                entry.isCurrentPlayer
                  ? "border-lime-brand/60 bg-lime-brand/10"
                  : "border-transparent bg-ink-900/70",
              )}
            >
              <span className="tabular w-8 text-xs font-bold text-ink-400">#{entry.rank}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink-100">{entry.displayName}</span>
                <span className="block text-[10px] text-ink-500">
                  {entry.country}
                  {entry.college ? ` · ${entry.college}` : ""} · {entry.gamesPlayed} games
                </span>
              </span>
              {entry.isPro ? <Pill tone="violet" icon="Crown">Pro</Pill> : null}
              {entry.simulated ? <span className="rounded-full bg-ink-800 px-1.5 py-0.5 text-[9px] text-ink-400">bot</span> : null}
              <span className="tabular text-sm font-bold text-ink-50">{entry.score.toLocaleString()}</span>
            </div>
          ))}
        </section>
      )}

      <InfoNote icon="Info">
        There is no leaderboard server in this build. Every row that is not you is generated deterministically
        and is marked “bot”; your own row uses your real local stats.
      </InfoNote>
    </div>
  );
}
