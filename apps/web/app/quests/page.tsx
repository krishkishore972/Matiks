"use client";

import { Button, Card, InfoNote, Pill, ProgressBar, SectionTitle, StateBlock } from "../../components/ui";
import { usePlayer } from "../../lib/state/player";

export default function QuestsPage() {
  const { bundle, loading, error, claimQuest } = usePlayer();

  if (loading) return <StateBlock state="loading" title="Loading quests" />;
  if (error || !bundle) return <StateBlock state="error" message={error ?? "No player data."} />;

  const quests = bundle.quests;
  const completed = quests.filter((quest) => quest.complete).length;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-black tracking-tight text-ink-50">Quests</h1>
        <p className="mt-1 text-xs text-ink-400">
          Daily objectives. Progress only counts when a play beats the mode&apos;s minimum score.
        </p>
      </section>

      <Card>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-50">
            {completed} of {quests.length} complete today
          </p>
          <Pill tone="gold" icon="Circle">
            {bundle.wallet.pies.toLocaleString()} Pies
          </Pill>
        </div>
        <div className="mt-3">
          <ProgressBar value={quests.length ? completed / quests.length : 0} label="Quest progress" tone="gold" />
        </div>
      </Card>

      <section className="animate-rise space-y-2">
        <SectionTitle title="Today" actionLabel="" />
        {quests.length === 0 ? (
          <StateBlock state="empty" message="No quests are available right now." />
        ) : (
          quests.map(({ quest, value, complete, claimed }) => (
            <Card key={quest.id} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-ink-50">{quest.title}</p>
                <Pill tone={claimed ? "neutral" : complete ? "lime" : "sky"} icon={claimed ? "Check" : undefined}>
                  {claimed ? "Claimed" : `${value}/${quest.target}`}
                </Pill>
              </div>
              <ProgressBar value={quest.target ? value / quest.target : 0} label={quest.title} />
              <div className="flex items-center justify-between">
                <span className="flex gap-2 text-[11px] text-ink-400">
                  {quest.reward.pies ? <span>+{quest.reward.pies} Pies</span> : null}
                  {quest.reward.xp ? <span>+{quest.reward.xp} XP</span> : null}
                </span>
                <Button
                  variant={complete && !claimed ? "primary" : "secondary"}
                  disabled={!complete || claimed}
                  onClick={() => void claimQuest(quest.id)}
                >
                  {claimed ? "Claimed" : complete ? "Claim reward" : "In progress"}
                </Button>
              </div>
            </Card>
          ))
        )}
      </section>

      <section className="animate-rise space-y-2">
        <InfoNote icon="Info">
          The shipped app exposes a Quests tab and a minimum-score rule, but its exact objective list is not
          present in the extracted strings. These five objectives are a documented recreation built on the
          evidenced counters (plays, duels, daily puzzles, perfect runs) — not Matiks&apos; own copy.
        </InfoNote>
      </section>
    </div>
  );
}
