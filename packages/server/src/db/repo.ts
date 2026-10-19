/**
 * Persistence for everything that is not a live duel.
 *
 * The semantics deliberately mirror the client's `LocalBackend` (same scoring
 * calls from @repo/core, same streak/shield rule, same quest counters) so that
 * switching the client from local storage to this server changes *where* the
 * data lives and nothing else. The differences are the ones you want from a
 * server: the clock is shared, the leaderboard is everyone's real plays, and
 * two devices see the same wallet.
 *
 * Queries are Drizzle rather than hand-written SQL. The shape of the data lives
 * in `schema.ts`, migrations are generated from it, and every statement here is
 * type-checked against the columns.
 */
import { createHash } from "node:crypto";
import {
  DAILY_PUZZLE_IDS,
  DUEL_IDS,
  GAMES,
  INFINITE_PUZZLE_IDS,
} from "@repo/core/catalog";
import {
  MAX_SHIELDS,
  STORE_ITEMS,
  XP_BOOSTER_MS,
  levelFromXp,
  todayKey,
  yesterdayKey,
} from "@repo/core/economy";
import type { LeaderboardCategory } from "@repo/core/leaderboard";
import { CATEGORY_GAMES } from "@repo/core/leaderboard";
import {
  applyResultToCounters,
  emptyCounters,
  evaluateQuests,
  type QuestCounters,
  type QuestProgress,
} from "@repo/core/quests";
import { createRng, seedFromString } from "@repo/core/rng";
import { countsForProgress, qualityBand, ratingDelta, xpFor } from "@repo/core/scoring";
import type {
  DailyChallengeState,
  Difficulty,
  GameId,
  GameRatingRecord,
  GameResult,
  LeaderboardEntry,
  LeaderboardScope,
  PlayerProfile,
  PlayerStats,
  QualityBand,
  StreakState,
  WalletState,
} from "@repo/core/types";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db, type Executor } from "./client";
import {
  dailyCompletions,
  players,
  playerStats,
  plays,
  questState,
  ratings,
  streaks,
  wallets,
} from "./schema";

/** Mirrors the client's `ProfileBundle` exactly. */
export interface ProfileBundle {
  profile: PlayerProfile;
  stats: PlayerStats;
  wallet: WalletState;
  streak: StreakState;
  ratings: GameRatingRecord[];
  history: GameResult[];
  daily: DailyChallengeState;
  quests: QuestProgress[];
  level: ReturnType<typeof levelFromXp>;
  pies: number;
}

export interface RecordRequest {
  result: GameResult;
  opponentScore?: number;
  /** A drawn duel: neither seat gains or loses rating. */
  isDraw?: boolean;
  difficulty?: Difficulty;
  expectedMs?: number;
  isDaily?: boolean;
}

export interface RecordOutcome {
  score: number;
  counted: boolean;
  xpGained: number;
  piesGained: number;
  ratingBefore: number;
  ratingAfter: number;
  ratingChange: number;
  band: QualityBand;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  streak: StreakState;
  won: boolean | null;
  dualedOpponentScore: number | null;
}

export interface PurchaseResult {
  ok: boolean;
  reason?: "insufficient" | "maxed" | "already-owned";
  wallet: WalletState;
}

const BOT_COUNT = 48;

/** One game per leaderboard board, so every board has bot rows on a fresh install. */
const BOT_GAMES: GameId[] = [
  ...new Set<GameId>([
    ...CATEGORY_GAMES.blitz,
    ...CATEGORY_GAMES.classical,
    ...CATEGORY_GAMES.memory,
    ...CATEGORY_GAMES.puzzle,
  ]),
];

/* ------------------------------------------------------------- players ---- */

/**
 * Create the player on first contact. The id is generated client-side and kept
 * in local storage, which is what the shipped app does for an anonymous
 * session; there is no password to check here.
 */
export async function ensurePlayer(
  playerId: string,
  patch: Partial<Pick<PlayerProfile, "handle" | "displayName" | "avatarSeed">> = {},
): Promise<void> {
  // Derived from the id rather than a short prefix, so two ids that share a
  // prefix (a test harness, a device farm) cannot collide on the unique handle.
  const digest = createHash("sha1").update(playerId).digest("hex").slice(0, 6);
  const handle = patch.handle ?? `player_${digest}`;
  const displayName = patch.displayName ?? handle;

  await db.transaction(async (tx) => {
    await tx
      .insert(players)
      .values({
        id: playerId,
        handle,
        displayName,
        avatarSeed: patch.avatarSeed ?? playerId.slice(0, 8),
        country: "IN",
        college: "Ashoka University",
        bio: "Playing the Matiks web recreation.",
      })
      .onConflictDoNothing();

    await tx.insert(playerStats).values({ playerId }).onConflictDoNothing();
    await tx
      .insert(wallets)
      .values({ playerId, skipsResetAt: todayKey() })
      .onConflictDoNothing();
    await tx.insert(streaks).values({ playerId }).onConflictDoNothing();
  });
}

/**
 * Deterministic AlphaBot roster.
 *
 * The shipped app has a literal `AlphaBot` and a `botEligibleAtMs` grace window,
 * and it seeds leaderboards with far more players than a fresh database has.
 * These are real rows flagged `is_bot`, and every API response marks them
 * `simulated: true` so the UI keeps labelling them honestly.
 */
export async function seedBots(): Promise<number> {
  const [existing] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(players)
    .where(eq(players.isBot, true));
  if ((existing?.count ?? 0) >= BOT_COUNT) return 0;

  const handles = [
    "aarav", "nisha", "dev", "tanvi", "kabir", "meera", "ishaan", "riya",
    "arjun", "zoya", "ved", "anaya", "reyansh", "kiara", "advik", "myra",
    "vihaan", "anika", "ayaan", "diya", "rohan", "sara", "kian", "aria",
    "neel", "misty", "kai", "lumi", "nix", "quill", "pixel", "zeta",
    "orbit", "vector", "tango", "sumo", "ninja", "piper", "quokka", "lynx",
    "ember", "sable", "ridge", "cobalt", "juno", "onyx", "wren", "flint",
  ];
  const countries = ["IN", "US", "GB", "SG", "DE", "BR", "JP", "AE", "NG", "AU"];
  const colleges = [
    "Ashoka University", "BITS Pilani", "IIT Bombay", "IIT Delhi", "VIT Vellore",
    "NIT Trichy", "Delhi University", "Manipal Institute", "Krea University", "IIIT Hyderabad",
  ];

  await db.transaction(async (tx) => {
    for (let i = 0; i < BOT_COUNT; i += 1) {
      const id = `bot-${i}`;
      const rng = createRng(seedFromString(`bot:${i}`));
      const handle = `${handles[i % handles.length]}${i >= handles.length ? i : ""}`;

      await tx
        .insert(players)
        .values({
          id,
          handle,
          displayName: handle,
          avatarSeed: `bot-${i}`,
          country: countries[rng.int(countries.length)],
          college: colleges[rng.int(colleges.length)],
          bio: "",
          isBot: true,
          botSkill: rng.next(),
        })
        .onConflictDoNothing();

      const gamesPlayed = 5 + rng.int(180);
      const xp = 400 + rng.int(9000);
      await tx
        .insert(playerStats)
        .values({
          playerId: id,
          gamesPlayed,
          gamesSolved: Math.round(gamesPlayed * (0.5 + rng.next() * 0.45)),
          totalTimeMs: gamesPlayed * (20_000 + rng.int(90_000)),
          xp,
          leaguePoints: Math.round(xp / 3),
          perfectRuns: rng.int(20),
        })
        .onConflictDoNothing();

      await tx
        .insert(wallets)
        .values({ playerId: id, skipsResetAt: todayKey() })
        .onConflictDoNothing();
      await tx
        .insert(streaks)
        .values({ playerId: id, current: rng.int(40), best: rng.int(60) })
        .onConflictDoNothing();

      // Real `plays` rows, not just totals: the per-category boards rank a
      // player's best score in each game, so a bot with no plays would be
      // invisible on every board except XP.
      for (const gameId of BOT_GAMES) {
        const meta = GAMES[gameId];
        const score = Math.round(meta.minScore + rng.next() * meta.minScore * 8);
        const daysAgo = rng.int(30);
        await tx.insert(plays).values({
          playerId: id,
          gameId,
          score,
          solved: score >= meta.minScore,
          accuracy: 0.6 + rng.next() * 0.4,
          durationMs: 20_000 + rng.int(120_000),
          difficulty: "medium",
          playedAt: new Date(Date.now() - daysAgo * 86_400_000),
        });
      }
    }
  });

  return BOT_COUNT;
}

/* -------------------------------------------------------------- bundle ---- */

async function dailyState(q: Executor, playerId: string): Promise<DailyChallengeState> {
  const day = todayKey();
  const rows = await q
    .select({ gameId: dailyCompletions.gameId })
    .from(dailyCompletions)
    .where(and(eq(dailyCompletions.playerId, playerId), eq(dailyCompletions.dayKey, day)));
  return { dayKey: day, completed: rows.map((row) => row.gameId), claimed: false };
}

async function countersFor(
  q: Executor,
  playerId: string,
): Promise<{ counters: QuestCounters; claimed: string[] }> {
  const [row] = await q
    .select({ counters: questState.counters, claimed: questState.claimed })
    .from(questState)
    .where(and(eq(questState.playerId, playerId), eq(questState.dayKey, todayKey())));

  if (!row) return { counters: emptyCounters(), claimed: [] };
  return { counters: { ...emptyCounters(), ...row.counters }, claimed: row.claimed ?? [] };
}

export async function loadBundle(playerId: string): Promise<ProfileBundle> {
  const [p] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!p) throw new Error(`unknown player ${playerId}`);

  const [[s], [w], [st], ratingRows, historyRows] = await Promise.all([
    db.select().from(playerStats).where(eq(playerStats.playerId, playerId)).limit(1),
    db.select().from(wallets).where(eq(wallets.playerId, playerId)).limit(1),
    db.select().from(streaks).where(eq(streaks.playerId, playerId)).limit(1),
    db
      .select()
      .from(ratings)
      .where(eq(ratings.playerId, playerId))
      .orderBy(asc(ratings.gameId)),
    db
      .select({
        gameId: plays.gameId,
        score: plays.score,
        solved: plays.solved,
        accuracy: plays.accuracy,
        durationMs: plays.durationMs,
        at: plays.playedAt,
      })
      .from(plays)
      .where(eq(plays.playerId, playerId))
      .orderBy(desc(plays.playedAt))
      .limit(50),
  ]);

  if (!s || !w || !st) throw new Error(`incomplete player ${playerId}`);

  const day = todayKey();
  const wallet: WalletState = {
    pies: w.pies,
    // Skips are a daily allowance: the counter is reset when the stored day
    // rolls over, exactly as the store describes it.
    skips: w.skipsResetAt === day ? w.skips : 3,
    skipsResetAt: w.skipsResetAt === day ? w.skipsResetAt : day,
    xpBoosterUntil:
      w.xpBoosterUntil && w.xpBoosterUntil.getTime() > Date.now()
        ? w.xpBoosterUntil.toISOString()
        : null,
  };

  const stats: PlayerStats = {
    gamesPlayed: s.gamesPlayed,
    gamesSolved: s.gamesSolved,
    totalTimeMs: s.totalTimeMs,
    xp: s.xp,
    leaguePoints: s.leaguePoints,
    perfectRuns: s.perfectRuns,
  };

  const streak: StreakState = {
    current: st.current,
    best: st.best,
    lastPlayedDay: st.lastPlayedDay,
    claimedDays: (st.claimedDays ?? []).map(Number),
    shields: st.shields,
  };

  const { counters, claimed } = await countersFor(db, playerId);

  return {
    profile: {
      id: p.id,
      handle: p.handle,
      displayName: p.displayName,
      avatarSeed: p.avatarSeed,
      country: p.country,
      college: p.college,
      joinedAt: p.createdAt.toISOString(),
      isPro: p.isPro,
      bio: p.bio,
    },
    stats,
    wallet,
    streak,
    ratings: ratingRows.map((row) => ({
      gameId: row.gameId,
      rating: row.rating,
      games: row.games,
      bestScore: row.bestScore,
    })),
    history: historyRows.map((row) => ({
      gameId: row.gameId,
      score: row.score,
      solved: row.solved,
      accuracy: row.accuracy,
      durationMs: row.durationMs,
      at: row.at.toISOString(),
    })),
    daily: await dailyState(db, playerId),
    quests: evaluateQuests(counters, claimed),
    level: levelFromXp(stats.xp),
    pies: wallet.pies,
  };
}

/* -------------------------------------------------------------- record ---- */

export async function recordPlay(
  playerId: string,
  request: RecordRequest,
): Promise<RecordOutcome> {
  const { result } = request;
  const meta = GAMES[result.gameId];

  return db.transaction(async (tx) => {
    await tx.select({ id: players.id }).from(players).where(eq(players.id, playerId)).for("update");

    const [ratingRow] = await tx
      .select({ rating: ratings.rating, games: ratings.games, bestScore: ratings.bestScore })
      .from(ratings)
      .where(and(eq(ratings.playerId, playerId), eq(ratings.gameId, result.gameId)));
    const before = ratingRow ?? { rating: 1200, games: 0, bestScore: 0 };

    const isDuel = DUEL_IDS.includes(result.gameId);
    const opponentScore = request.opponentScore ?? null;
    const isDraw = request.isDraw === true;
    const won =
      isDuel && opponentScore !== null && !isDraw ? result.score > opponentScore : null;
    const opponentRating =
      1200 + (opponentScore !== null ? Math.min(400, Math.round(opponentScore / 2)) : 0);

    const change = isDraw
      ? 0
      : isDuel && won !== null
        ? ratingDelta(before.rating, opponentRating, won, before.games)
        : result.solved
          ? Math.max(1, Math.round((result.accuracy - 0.5) * 10))
          : -6;

    const after = {
      rating: Math.max(100, before.rating + change),
      games: before.games + 1,
      bestScore: Math.max(before.bestScore, result.score),
    };

    await tx
      .insert(ratings)
      .values({
        playerId,
        gameId: result.gameId,
        rating: after.rating,
        games: after.games,
        bestScore: after.bestScore,
      })
      .onConflictDoUpdate({
        target: [ratings.playerId, ratings.gameId],
        set: { rating: after.rating, games: after.games, bestScore: after.bestScore },
      });

    const [wallet] = await tx
      .select({ xpBoosterUntil: wallets.xpBoosterUntil })
      .from(wallets)
      .where(eq(wallets.playerId, playerId));
    const boosterActive =
      wallet?.xpBoosterUntil != null && wallet.xpBoosterUntil.getTime() > Date.now();

    const xpGained = xpFor(result, boosterActive ? 2 : 1);
    const counted = countsForProgress(result);
    const piesGained = counted ? 10 + Math.round(result.score / 200) : 0;

    const [statBefore] = await tx
      .select({ xp: playerStats.xp })
      .from(playerStats)
      .where(eq(playerStats.playerId, playerId));
    const levelBefore = levelFromXp(statBefore?.xp ?? 0).level;

    await tx.insert(plays).values({
      playerId,
      gameId: result.gameId,
      score: result.score,
      solved: result.solved,
      accuracy: result.accuracy,
      durationMs: result.durationMs,
      mistakes: Number(result.detail?.mistakes ?? 0),
      difficulty: request.difficulty ?? "medium",
      isDaily: Boolean(request.isDaily),
    });

    await tx
      .update(playerStats)
      .set({
        gamesPlayed: sql`${playerStats.gamesPlayed} + 1`,
        gamesSolved: sql`${playerStats.gamesSolved} + ${result.solved ? 1 : 0}`,
        totalTimeMs: sql`${playerStats.totalTimeMs} + ${result.durationMs}`,
        xp: sql`${playerStats.xp} + ${xpGained}`,
        leaguePoints: sql`${playerStats.leaguePoints} + ${
          meta.rated ? Math.max(0, Math.round(result.score / 20)) : 0
        }`,
        perfectRuns: sql`${playerStats.perfectRuns} + ${
          result.solved && result.accuracy >= 1 ? 1 : 0
        }`,
      })
      .where(eq(playerStats.playerId, playerId));

    await tx
      .update(wallets)
      .set({ pies: sql`${wallets.pies} + ${piesGained}` })
      .where(eq(wallets.playerId, playerId));

    // Quest counters are daily; a new day starts from empty.
    const { counters, claimed } = await countersFor(tx, playerId);
    const nextCounters = applyResultToCounters(counters, result, Boolean(request.isDaily));
    await tx
      .insert(questState)
      .values({ playerId, dayKey: todayKey(), counters: nextCounters, claimed })
      .onConflictDoUpdate({
        target: [questState.playerId, questState.dayKey],
        set: { counters: nextCounters },
      });

    if (request.isDaily && result.solved) {
      await tx
        .insert(dailyCompletions)
        .values({ playerId, dayKey: todayKey(), gameId: result.gameId })
        .onConflictDoNothing();
    }

    const streak = counted
      ? await touchStreak(tx, playerId)
      : await readStreak(tx, playerId);
    const [statAfter] = await tx
      .select({ xp: playerStats.xp })
      .from(playerStats)
      .where(eq(playerStats.playerId, playerId));
    const levelAfter = levelFromXp(statAfter?.xp ?? 0).level;

    return {
      score: result.score,
      counted,
      xpGained,
      piesGained,
      ratingBefore: before.rating,
      ratingAfter: after.rating,
      ratingChange: change,
      band: qualityBand(
        result.durationMs,
        request.expectedMs ?? Math.max(30_000, result.durationMs),
      ),
      levelBefore,
      levelAfter,
      leveledUp: levelAfter > levelBefore,
      streak,
      won,
      dualedOpponentScore: opponentScore,
    };
  });
}

async function readStreak(q: Executor, playerId: string): Promise<StreakState> {
  const [row] = await q
    .select({
      current: streaks.current,
      best: streaks.best,
      lastPlayedDay: streaks.lastPlayedDay,
      claimedDays: streaks.claimedDays,
      shields: streaks.shields,
    })
    .from(streaks)
    .where(eq(streaks.playerId, playerId));

  if (!row) {
    return { current: 0, best: 0, lastPlayedDay: null, claimedDays: [], shields: 0 };
  }
  return {
    current: row.current,
    best: row.best,
    lastPlayedDay: row.lastPlayedDay,
    claimedDays: (row.claimedDays ?? []).map(Number),
    shields: row.shields,
  };
}

/** Same rule as the client: consecutive days advance, a shield absorbs one miss. */
async function touchStreak(q: Executor, playerId: string): Promise<StreakState> {
  const streak = await readStreak(q, playerId);
  const today = todayKey();
  if (streak.lastPlayedDay === today) return streak;

  if (streak.lastPlayedDay === yesterdayKey()) {
    streak.current += 1;
  } else if (streak.current > 0 && streak.shields > 0) {
    streak.shields -= 1;
    streak.current += 1;
  } else {
    streak.current = 1;
  }
  streak.lastPlayedDay = today;
  streak.best = Math.max(streak.best, streak.current);

  await q
    .update(streaks)
    .set({
      current: streak.current,
      best: streak.best,
      lastPlayedDay: streak.lastPlayedDay,
      shields: streak.shields,
    })
    .where(eq(streaks.playerId, playerId));
  return streak;
}

/* ------------------------------------------------------------- wallet ---- */

export async function purchaseItem(
  playerId: string,
  itemId: string,
): Promise<PurchaseResult> {
  const item = STORE_ITEMS.find((candidate) => candidate.id === itemId);

  return db.transaction(async (tx) => {
    await tx.select({ id: players.id }).from(players).where(eq(players.id, playerId)).for("update");
    const [row] = await tx
      .select({
        pies: wallets.pies,
        skips: wallets.skips,
        skipsResetAt: wallets.skipsResetAt,
        xpBoosterUntil: wallets.xpBoosterUntil,
      })
      .from(wallets)
      .where(eq(wallets.playerId, playerId));

    if (!row) throw new Error(`unknown wallet ${playerId}`);

    const day = todayKey();
    const wallet: WalletState = {
      pies: row.pies,
      skips: row.skipsResetAt === day ? row.skips : 3,
      skipsResetAt: day,
      xpBoosterUntil:
        row.xpBoosterUntil && row.xpBoosterUntil.getTime() > Date.now()
          ? row.xpBoosterUntil.toISOString()
          : null,
    };

    if (!item) return { ok: false, reason: "already-owned", wallet };
    if (wallet.pies < item.cost) return { ok: false, reason: "insufficient", wallet };

    let shields: number | null = null;
    let skips = wallet.skips;

    if (itemId === "streak-shield") {
      const streak = await readStreak(tx, playerId);
      if (streak.shields >= MAX_SHIELDS) return { ok: false, reason: "maxed", wallet };
      shields = streak.shields + 1;
    } else if (itemId === "snacc-skip") {
      skips += 1;
    }

    const boosterUntilDate =
      itemId === "xp-booster"
        ? new Date(
            (wallet.xpBoosterUntil ? new Date(wallet.xpBoosterUntil).getTime() : Date.now()) +
              XP_BOOSTER_MS,
          )
        : null;
    const boosterUntil = boosterUntilDate?.toISOString() ?? wallet.xpBoosterUntil;

    await tx
      .update(wallets)
      .set({
        pies: wallet.pies - item.cost,
        skips,
        skipsResetAt: day,
        xpBoosterUntil: boosterUntilDate,
      })
      .where(eq(wallets.playerId, playerId));

    if (shields !== null) {
      await tx.update(streaks).set({ shields }).where(eq(streaks.playerId, playerId));
    }

    return {
      ok: true,
      wallet: {
        pies: wallet.pies - item.cost,
        skips,
        skipsResetAt: day,
        xpBoosterUntil: boosterUntil,
      },
    };
  });
}

export async function claimQuest(
  playerId: string,
  questId: string,
): Promise<ProfileBundle | null> {
  const claimed = await db.transaction(async (tx) => {
    await tx.select({ id: players.id }).from(players).where(eq(players.id, playerId)).for("update");
    const { counters, claimed: alreadyClaimed } = await countersFor(tx, playerId);
    const progress = evaluateQuests(counters, alreadyClaimed).find(
      (entry) => entry.quest.id === questId,
    );
    if (!progress || !progress.complete || progress.claimed) return false;

    const reward = progress.quest.reward;
    await tx
      .insert(questState)
      .values({
        playerId,
        dayKey: todayKey(),
        counters,
        claimed: [...alreadyClaimed, questId],
      })
      .onConflictDoUpdate({
        target: [questState.playerId, questState.dayKey],
        set: { claimed: [...alreadyClaimed, questId] },
      });
    await tx
      .update(wallets)
      .set({ pies: sql`${wallets.pies} + ${reward.pies ?? 0}` })
      .where(eq(wallets.playerId, playerId));
    await tx
      .update(playerStats)
      .set({ xp: sql`${playerStats.xp} + ${reward.xp ?? 0}` })
      .where(eq(playerStats.playerId, playerId));
    return true;
  });

  return claimed ? loadBundle(playerId) : null;
}

/* ------------------------------------------------------------- profile ---- */

export async function updateProfile(
  playerId: string,
  patch: Partial<PlayerProfile>,
): Promise<PlayerProfile> {
  const patchSet: Partial<typeof players.$inferInsert> = {};
  if (patch.handle !== undefined) patchSet.handle = patch.handle;
  if (patch.displayName !== undefined) patchSet.displayName = patch.displayName;
  if (patch.avatarSeed !== undefined) patchSet.avatarSeed = patch.avatarSeed;
  if (patch.country !== undefined) patchSet.country = patch.country;
  if (patch.college !== undefined) patchSet.college = patch.college;
  if (patch.bio !== undefined) patchSet.bio = patch.bio;

  if (Object.keys(patchSet).length > 0) {
    await db.update(players).set(patchSet).where(eq(players.id, playerId));
  }

  const bundle = await loadBundle(playerId);
  return bundle.profile;
}

export async function resetPlayer(playerId: string): Promise<ProfileBundle> {
  await db.transaction(async (tx) => {
    await tx.delete(plays).where(eq(plays.playerId, playerId));
    await tx.delete(ratings).where(eq(ratings.playerId, playerId));
    await tx.delete(dailyCompletions).where(eq(dailyCompletions.playerId, playerId));
    await tx.delete(questState).where(eq(questState.playerId, playerId));
    await tx
      .update(playerStats)
      .set({
        gamesPlayed: 0,
        gamesSolved: 0,
        totalTimeMs: 0,
        xp: 0,
        leaguePoints: 0,
        perfectRuns: 0,
      })
      .where(eq(playerStats.playerId, playerId));
    await tx
      .update(wallets)
      .set({
        pies: 500,
        skips: 3,
        skipsResetAt: todayKey(),
        xpBoosterUntil: null,
      })
      .where(eq(wallets.playerId, playerId));
    await tx
      .update(streaks)
      .set({
        current: 0,
        best: 0,
        lastPlayedDay: null,
        claimedDays: [],
        shields: 1,
      })
      .where(eq(streaks.playerId, playerId));
  });
  return loadBundle(playerId);
}

/* --------------------------------------------------------- leaderboard ---- */

interface BoardRow {
  id: string;
  displayName: string;
  avatarSeed: string;
  country: string;
  college: string;
  isPro: boolean;
  isBot: boolean;
  score: number;
  games: number;
}

/**
 * Real rankings.
 *
 * Per-category boards sum each player's *best* score in every game feeding that
 * board; `xp` is the account-wide total. Bots are ordinary rows, but they come
 * back flagged `simulated: true` so the existing UI badge stays truthful.
 */
export async function leaderboardFor(
  scope: LeaderboardScope,
  category: LeaderboardCategory,
  playerId: string,
): Promise<LeaderboardEntry[]> {
  const limit = scope === "friends" ? 12 : 50;
  const categoryGames: GameId[] = category === "xp" ? [] : CATEGORY_GAMES[category];

  const [me] = await db
    .select({ college: players.college })
    .from(players)
    .where(eq(players.id, playerId));
  const college = me?.college ?? "";

  const rows = await readBoard(scope, category, categoryGames, college, playerId, limit);

  const entries: LeaderboardEntry[] = rows.map((row, index) => ({
    rank: index + 1,
    playerId: row.id,
    displayName: row.displayName,
    avatarSeed: row.avatarSeed,
    country: row.country,
    college: scope === "college" ? row.college : undefined,
    score: row.score,
    gamesPlayed: row.games,
    isPro: row.isPro,
    isCurrentPlayer: row.id === playerId,
    simulated: row.isBot || undefined,
  }));

  // The current player is always present, even when they are outside the cut.
  if (!entries.some((entry) => entry.isCurrentPlayer)) {
    const mine = await readMine(category, categoryGames, playerId);
    if (mine) {
      entries.push({
        rank: entries.length + 1,
        playerId: mine.id,
        displayName: mine.displayName,
        avatarSeed: mine.avatarSeed,
        country: mine.country,
        college: scope === "college" ? mine.college : undefined,
        score: mine.score,
        gamesPlayed: mine.games,
        isPro: mine.isPro,
        isCurrentPlayer: true,
      });
    }
  }

  if (scope === "friends") {
    // There is no social graph in the artifact, so "friends" is the current
    // player plus other *real* accounts. Bots are never presented as friends.
    const real = entries.filter((entry) => !entry.simulated);
    const trimmed = real.length > 0 ? real : entries.filter((entry) => entry.isCurrentPlayer);
    trimmed.sort((a, b) => b.score - a.score);
    trimmed.forEach((entry, index) => {
      entry.rank = index + 1;
    });
    return trimmed;
  }

  entries.sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  return entries;
}

async function readBoard(
  scope: LeaderboardScope,
  category: LeaderboardCategory,
  categoryGames: GameId[],
  college: string,
  playerId: string,
  limit: number,
): Promise<BoardRow[]> {
  const sameCollege = eq(players.college, college);

  if (category === "xp") {
    const rows = await db
      .select({
        id: players.id,
        displayName: players.displayName,
        avatarSeed: players.avatarSeed,
        country: players.country,
        college: players.college,
        isPro: players.isPro,
        isBot: players.isBot,
        score: playerStats.xp,
        games: playerStats.gamesPlayed,
      })
      .from(players)
      .innerJoin(playerStats, eq(playerStats.playerId, players.id))
      .where(scope === "college" ? sameCollege : undefined)
      .orderBy(desc(playerStats.xp))
      .limit(limit);
    return rows;
  }

  const perGame = db
    .select({
      playerId: plays.playerId,
      gameId: plays.gameId,
      best: sql<number>`max(${plays.score})`.as("best"),
    })
    .from(plays)
    .where(inArray(plays.gameId, categoryGames))
    .groupBy(plays.playerId, plays.gameId)
    .as("per_game");

  const totals = db
    .select({
      playerId: perGame.playerId,
      score: sql<number>`coalesce(sum(${perGame.best}), 0)::int`.as("score"),
      games: sql<number>`count(*)::int`.as("games"),
    })
    .from(perGame)
    .groupBy(perGame.playerId)
    .as("totals");

  const scoreExpr = sql<number>`coalesce(${totals.score}, 0)`;
  const visible = or(sql`${scoreExpr} > 0`, eq(players.id, playerId));

  const rows = await db
    .select({
      id: players.id,
      displayName: players.displayName,
      avatarSeed: players.avatarSeed,
      country: players.country,
      college: players.college,
      isPro: players.isPro,
      isBot: players.isBot,
      score: sql<number>`${scoreExpr}::int`,
      games: sql<number>`coalesce(${totals.games}, 0)::int`,
    })
    .from(players)
    .leftJoin(totals, eq(totals.playerId, players.id))
    .where(scope === "college" ? and(sameCollege, visible) : visible)
    .orderBy(desc(scoreExpr), asc(players.displayName))
    .limit(limit);
  return rows;
}

async function readMine(
  category: LeaderboardCategory,
  categoryGames: GameId[],
  playerId: string,
): Promise<BoardRow | null> {
  const [row] = await db
    .select({
      id: players.id,
      displayName: players.displayName,
      avatarSeed: players.avatarSeed,
      country: players.country,
      college: players.college,
      isPro: players.isPro,
      isBot: players.isBot,
      xp: playerStats.xp,
      games: playerStats.gamesPlayed,
    })
    .from(players)
    .innerJoin(playerStats, eq(playerStats.playerId, players.id))
    .where(eq(players.id, playerId));

  if (!row) return null;
  if (category === "xp") return { ...row, score: row.xp };

  const perGame = db
    .select({
      playerId: plays.playerId,
      gameId: plays.gameId,
      best: sql<number>`max(${plays.score})`.as("best"),
    })
    .from(plays)
    .where(and(eq(plays.playerId, playerId), inArray(plays.gameId, categoryGames)))
    .groupBy(plays.playerId, plays.gameId)
    .as("per_game");

  const [categoryScore] = await db
    .select({ score: sql<number>`coalesce(sum(${perGame.best}), 0)::int` })
    .from(perGame);

  return { ...row, score: categoryScore?.score ?? 0 };
}

export const PUZZLE_TABS = {
  daily: [...DAILY_PUZZLE_IDS],
  infinite: [...INFINITE_PUZZLE_IDS],
};
