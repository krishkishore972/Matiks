"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { usePlayer } from "../lib/state/player";
import { cn } from "../lib/utils/cn";
import { Icon } from "./icons";

/**
 * Navigation model.
 *
 * The shipped app has a deep bottom bar (Arena / Compete / Feed / Puzzles /
 * Quests / Nets / Snacc / More). The web recreation keeps the five destinations
 * that carry real functionality here, and folds Feed, Nets and Snacc into
 * Home / More and a dedicated /store route. See docs/reference-analysis.md.
 */
const TABS = [
  { href: "/", label: "Arena", icon: "Home" },
  { href: "/puzzles", label: "Puzzles", icon: "Puzzle" },
  { href: "/compete", label: "Compete", icon: "Swords" },
  { href: "/quests", label: "Quests", icon: "Target" },
  { href: "/more", label: "More", icon: "User" },
];

function TopBar() {
  const { bundle } = usePlayer();
  const streak = bundle?.streak.current ?? 0;
  const pies = bundle?.wallet.pies ?? 0;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink-800 bg-ink-950/90 px-4 py-3 backdrop-blur">
      <Link href="/" className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink-850 text-sm font-black text-lime-brand">
          m
        </span>
        <span className="text-sm font-bold tracking-tight text-ink-50">matiks</span>
      </Link>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-ink-800 px-2.5 py-1 text-xs font-semibold text-gold">
          <Icon name="Circle" className="h-3.5 w-3.5" />
          {pies.toLocaleString()}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-lime-brand/15 px-2.5 py-1 text-xs font-semibold text-lime-brand">
          <Icon name="Flame" className="h-3.5 w-3.5" />
          {streak}
        </span>
      </div>
    </header>
  );
}

function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[520px] -translate-x-1/2 border-t border-ink-800 bg-ink-950/95 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
      <ul className="flex items-stretch justify-between">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-semibold transition",
                  active ? "text-lime-brand" : "text-ink-400 hover:text-ink-200",
                )}
              >
                <Icon name={tab.icon} className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col border-x border-ink-900 bg-ink-950">
      <TopBar />
      <main className="flex-1 px-4 pt-4 pb-28">{children}</main>
      <BottomNav />
    </div>
  );
}
