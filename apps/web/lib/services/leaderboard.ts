/**
 * Leaderboards.
 *
 * IMPORTANT: there is no server in this recreation. Every row that is not the
 * signed-in player is **simulated** and is labelled `simulated: true`; the UI
 * says so explicitly. When a real backend exists, replace `buildRoster` with a
 * fetch and the rest of the app does not change.
 */
import { createRng, seedFromString } from "../rng";
import type { LeaderboardEntry, LeaderboardScope, PlayerProfile, PlayerStats } from "../types";

/** `leaderboard.category.labels.*` from the shipped bundle. */
export type LeaderboardCategory = "blitz" | "classical" | "memory" | "puzzle" | "xp";

export const LEADERBOARD_CATEGORIES: Array<{ id: LeaderboardCategory; label: string }> = [
  { id: "blitz", label: "Blitz" },
  { id: "classical", label: "Classical" },
  { id: "memory", label: "Memory" },
  { id: "puzzle", label: "Puzzle" },
  { id: "xp", label: "XP" },
];

export const LEADERBOARD_SCOPES: Array<{ id: LeaderboardScope; label: string }> = [
  { id: "global", label: "Global" },
  { id: "friends", label: "Friends" },
  { id: "college", label: "College" },
];

const HANDLES = [
  "aarav","nisha","dev","tanvi","kabir","meera","ishaan","riya","arjun","zoya",
  "ved","anaya","reyansh","kiara","advik","myra","vihaan","anika","ayaan","diya",
  "rohan","sara","kian","aria","neel","misty","kai","lumi","nix","quill",
  "pixel","zeta","orbit","vector","tango","sumo","ninja","piper","quokka","lynx",
];

const COUNTRIES = ["IN","US","GB","SG","DE","BR","JP","AE","NG","AU"];
const COLLEGES = [
  "Ashoka University","BITS Pilani","IIT Bombay","IIT Delhi","VIT Vellore",
  "NIT Trichy","Delhi University","Manipal Institute","Krea University","IIIT Hyderabad",
];

function nameFor(index: number, scope: LeaderboardScope): string {
  return `${HANDLES[index % HANDLES.length]}${scope === "college" ? "·campus" : ""}`;
}

/**
 * Deterministic roster for a category/scope. Scores are seeded by the day so the
 * board is stable within a session but moves day to day.
 */
export function buildRoster(
  scope: LeaderboardScope,
  category: LeaderboardCategory,
  dayKey: string,
  stats: PlayerStats,
  profile: PlayerProfile,
): LeaderboardEntry[] {
  const rng = createRng(seedFromString(`${scope}:${category}:${dayKey}`));
  const size = scope === "friends" ? 12 : 40;

  const base: Record<LeaderboardCategory, { min: number; span: number }> = {
    blitz: { min: 120, span: 480 },
    classical: { min: 900, span: 1100 },
    memory: { min: 40, span: 260 },
    puzzle: { min: 300, span: 1500 },
    xp: { min: 400, span: 6000 },
  };

  const entries: LeaderboardEntry[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < size; i++) {
    let handle = nameFor(rng.int(HANDLES.length), scope);
    let guard = 0;
    while (seen.has(handle) && guard++ < 50) handle = `${nameFor(rng.int(HANDLES.length), scope)}${rng.int(99)}`;
    seen.add(handle);
    entries.push({
      rank: 0,
      playerId: `sim-${scope}-${i}`,
      displayName: handle,
      avatarSeed: `sim-${scope}-${i}`,
      country: COUNTRIES[rng.int(COUNTRIES.length)],
      college: scope === "college" ? COLLEGES[rng.int(COLLEGES.length)] : undefined,
      score: Math.round(base[category].min + rng.next() * base[category].span),
      gamesPlayed: 5 + rng.int(180),
      isPro: rng.next() < 0.2,
      simulated: true,
    });
  }

  const playerScore =
    category === "xp"
      ? stats.xp
      : category === "blitz"
        ? stats.leaguePoints
        : category === "classical"
          ? stats.leaguePoints
          : Math.round(stats.gamesSolved * 12 + stats.perfectRuns * 40);

  entries.push({
    rank: 0,
    playerId: profile.id,
    displayName: profile.displayName,
    avatarSeed: profile.avatarSeed,
    country: profile.country,
    college: profile.college,
    score: playerScore,
    gamesPlayed: stats.gamesPlayed,
    isPro: profile.isPro,
    isCurrentPlayer: true,
  });

  entries.sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  return entries;
}
