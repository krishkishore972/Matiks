"use client";

import { useEffect, useState } from "react";
import { Button, Card, InfoNote, Pill, SectionTitle, StateBlock } from "../../components/ui";
import { Icon } from "../../components/icons";
import { MAX_SHIELDS, STORE_ITEMS } from "../../lib/services/backend";
import { usePlayer } from "../../lib/state/player";

export default function StorePage() {
  const { bundle, loading, error, purchase } = usePlayer();
  const [message, setMessage] = useState<string | null>(null);
  // The booster expiry is compared against a ticking clock rather than
  // `Date.now()` during render, so the badge also flips back when it lapses.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (loading) return <StateBlock state="loading" title="Opening the Pi Store" />;
  if (error || !bundle) return <StateBlock state="error" message={error ?? "No player data."} />;

  async function buy(itemId: string, name: string, cost: number) {
    const result = await purchase(itemId);
    if (result.ok) setMessage(`${name} purchased for ${cost} Pies.`);
    else if (result.reason === "insufficient") setMessage(`Not enough Pies for ${name}.`);
    else if (result.reason === "maxed") setMessage(`${name} is already at its maximum of ${MAX_SHIELDS}.`);
    else setMessage(`${name} could not be purchased.`);
  }

  const boosterActive = Boolean(
    bundle.wallet.xpBoosterUntil &&
      now !== null &&
      new Date(bundle.wallet.xpBoosterUntil).getTime() > now,
  );

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-black tracking-tight text-ink-50">Pi Store</h1>
        <p className="mt-1 text-xs text-ink-400">
          Spend Pies — the soft currency you earn by finishing boards above the minimum score.
        </p>
      </section>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-ink-400">Balance</p>
            <p className="tabular text-2xl font-black text-gold">{bundle.wallet.pies.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <Pill tone={boosterActive ? "lime" : "neutral"} icon="Zap">
              {boosterActive ? "XP booster active" : "No booster"}
            </Pill>
            <p className="mt-1 text-[11px] text-ink-400">
              {bundle.streak.shields}/{MAX_SHIELDS} shields · {bundle.wallet.skips} skips
            </p>
          </div>
        </div>
      </Card>

      {message ? (
        <p className="rounded-xl bg-lime-brand/12 px-3 py-2 text-xs font-semibold text-lime-brand">{message}</p>
      ) : null}

      <section className="animate-rise space-y-2">
        <SectionTitle title="Items" actionLabel="" />
        {STORE_ITEMS.map((item) => (
          <Card key={item.id} className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-800 text-lime-brand">
              <Icon name={item.icon} className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-50">{item.name}</p>
              <p className="mt-0.5 text-xs text-ink-300">{item.description}</p>
            </div>
            <div className="text-right">
              <p className="tabular text-sm font-bold text-gold">{item.cost}</p>
              <Button
                variant="secondary"
                className="mt-1"
                disabled={bundle.wallet.pies < item.cost}
                onClick={() => void buy(item.id, item.name, item.cost)}
              >
                Buy
              </Button>
            </div>
          </Card>
        ))}
      </section>

      <InfoNote icon="Info">
        Pies, Statik Coins, Snacc Skips, the XP Booster and Streak Shields are all named in the shipped
        app. Snacc Skips are spent in Snacc, the endless puzzle ladder — not here. Statik Coins are a
        hard-currency premium item and are therefore not purchasable in this offline build.
      </InfoNote>
    </div>
  );
}
