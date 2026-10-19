"use client";

import { useState } from "react";
import { Button, Card, InfoNote, Pill, SectionTitle, StatBlock, StateBlock } from "../../components/ui";
import { GAMES } from "../../lib/catalog";
import { usePlayer } from "../../lib/state/player";
import { QUALITY_BAND_LABEL, qualityBand } from "../../lib/scoring";
import { formatDuration, formatPercent } from "../../lib/utils/cn";

export default function ProfilePage() {
  const { bundle, loading, error, updateProfile } = usePlayer();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  if (loading) return <StateBlock state="loading" title="Loading statistics" />;
  if (error || !bundle) return <StateBlock state="error" message={error ?? "No player data."} />;

  const { profile, stats, ratings, history, level } = bundle;
  const accuracy = stats.gamesPlayed === 0 ? 0 : stats.gamesSolved / stats.gamesPlayed;
  const medianTime = (() => {
    if (history.length === 0) return 0;
    const times = history.map((entry) => entry.durationMs).sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)];
  })();

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-black tracking-tight text-ink-50">Profile</h1>
        <p className="mt-1 text-xs text-ink-400">Everything you have played, stored locally in this browser.</p>
      </section>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-50">Display name</p>
          <Pill tone="lime" icon="Star">Level {level.level}</Pill>
        </div>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, 20))}
            placeholder={profile.displayName}
            className="flex-1 rounded-xl border border-ink-700 bg-ink-950 px-3 py-2.5 text-sm text-ink-50 outline-none focus:border-lime-brand"
          />
          <Button
            disabled={saving || name.trim().length === 0}
            onClick={() => {
              setSaving(true);
              void updateProfile({ displayName: name.trim() }).finally(() => {
                setSaving(false);
                setName("");
              });
            }}
          >
            Save
          </Button>
        </div>
      </Card>

      <section className="animate-rise">
        <SectionTitle title="Lifetime" actionLabel="" />
        <div className="grid grid-cols-3 gap-3">
          <StatBlock label="Games" value={`${stats.gamesPlayed}`} icon="Play" />
          <StatBlock label="Solved" value={`${stats.gamesSolved}`} icon="Check" tone="#b1fa63" />
          <StatBlock label="Accuracy" value={formatPercent(accuracy)} icon="Target" />
          <StatBlock label="Perfect" value={`${stats.perfectRuns}`} icon="Award" tone="#ffc53d" />
          <StatBlock label="Median time" value={medianTime ? formatDuration(medianTime) : "—"} icon="Clock" />
          <StatBlock label="XP" value={stats.xp.toLocaleString()} icon="Sparkles" tone="#9d7bff" />
        </div>
      </section>

      <section className="animate-rise space-y-2">
        <SectionTitle title="Ratings by mode" actionLabel="" />
        {ratings.length === 0 ? (
          <StateBlock state="empty" message="No rated games yet. Play a duel to open your ladder." />
        ) : (
          <Card className="space-y-2">
            {ratings.map((record) => (
              <div key={record.gameId} className="flex items-center justify-between text-sm">
                <span className="text-ink-200">{GAMES[record.gameId]?.title ?? record.gameId}</span>
                <span className="tabular text-ink-50">
                  {record.rating}
                  <span className="ml-2 text-[10px] text-ink-400">
                    {record.games} games · best {record.bestScore}
                  </span>
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="animate-rise space-y-2">
        <SectionTitle title="Recent plays" actionLabel="" />
        {history.length === 0 ? (
          <StateBlock state="empty" message="Nothing played yet — the arena is waiting." />
        ) : (
          <div className="space-y-1.5">
            {history.slice(0, 12).map((entry, index) => {
              const meta = GAMES[entry.gameId];
              const band = qualityBand(entry.durationMs, Math.max(30_000, entry.durationMs));
              return (
                <div
                  key={`${entry.at}-${index}`}
                  className="flex items-center gap-3 rounded-xl border border-transparent bg-ink-900/70 px-3 py-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink-100">{meta?.title ?? entry.gameId}</span>
                    <span className="block text-[10px] text-ink-500">
                      {new Date(entry.at).toLocaleString()} · {formatDuration(entry.durationMs)} ·{" "}
                      {formatPercent(entry.accuracy)} accuracy
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="tabular block text-sm font-bold text-ink-50">{entry.score}</span>
                    <span className="block text-[10px] text-ink-400" title={QUALITY_BAND_LABEL[band]}>
                      {band}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <InfoNote icon="Info">
        A play is only recorded when you finish or end an attempt. Every wrong answer, backspace and clear
        counts towards accuracy, so 100% means a genuinely clean run.
      </InfoNote>
    </div>
  );
}
