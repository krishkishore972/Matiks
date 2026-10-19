/**
 * Economy and time rules shared by the client and the server.
 *
 * These have to agree exactly: the server pays out XP and Pies, but the client
 * renders the level bar and the store, and the two must never disagree about
 * what a level costs or which day it is. Level curve and store prices are
 * inferred from the artifact, not recovered — see docs/reference-analysis.md.
 */
import type { GameId } from "./types";

export const DAY_MS = 86_400_000;

export function todayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function yesterdayKey(date = new Date()): string {
  return todayKey(new Date(date.getTime() - DAY_MS));
}

/** Daily boards are seeded from the date key so everybody sees the same board. */
export function dailySeed(dayKey: string, gameId: GameId): string {
  return `daily:${dayKey}:${gameId}`;
}

/** Practice boards rotate on a per-session counter so they are always new. */
export function practiceSeed(gameId: GameId, nonce: number): string {
  const day = todayKey();
  return `practice:${day}:${gameId}:${nonce}`;
}

export const XP_BOOSTER_MS = 15 * 60 * 1000;
export const STREAK_SHIELD_COST = 200;
export const MAX_SHIELDS = 2;

export interface LevelInfo {
  level: number;
  intoLevel: number;
  levelSpan: number;
  progress: number;
}

/** Level curve: level n costs 250·n XP. Inferred, not recovered. */
export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  let remaining = xp;
  while (remaining >= 250 * level && level < 999) {
    remaining -= 250 * level;
    level += 1;
  }
  const span = 250 * level;
  return {
    level,
    intoLevel: remaining,
    levelSpan: span,
    progress: span > 0 ? Math.min(1, remaining / span) : 0,
  };
}

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: string;
}

export const STORE_ITEMS: StoreItem[] = [
  {
    id: "streak-shield",
    name: "Streak Shield",
    description: "Protects your streak if you miss a day. Holds a maximum of 2.",
    cost: STREAK_SHIELD_COST,
    icon: "Shield",
  },
  {
    id: "snacc-skip",
    name: "Snacc Skip",
    description: "Skips one board in Snacc, the endless puzzle ladder.",
    cost: 120,
    icon: "SkipForward",
  },
  {
    id: "xp-booster",
    name: "XP Booster",
    description: "Double XP for the next 15 minutes of play.",
    cost: 150,
    icon: "Zap",
  },
];
