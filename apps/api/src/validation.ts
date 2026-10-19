/**
 * Request validation.
 *
 * Every value that crosses the HTTP boundary is parsed here before it reaches
 * the domain: ids from the header and the path, the play payload, the profile
 * patch and the leaderboard query. The inferred types are what the routes pass
 * on, so a route cannot accidentally accept a shape the schema rejects.
 */
import { GAMES } from "@repo/core/catalog";
import type { LeaderboardCategory } from "@repo/core/leaderboard";
import type { Difficulty, GameId, LeaderboardScope } from "@repo/core/types";
import { z } from "zod";
import { HttpError } from "./errors";

const GAME_IDS = Object.keys(GAMES) as [GameId, ...GameId[]];

export const gameIdSchema = z.enum(GAME_IDS);

/**
 * Anonymous session ids are client-generated UUIDs, but tests and the browser
 * console legitimately use readable ids too. This constrains them to a safe
 * charset and length without pretending to authenticate them.
 */
export const playerIdSchema = z
  .string({ error: "x-player-id header required" })
  .min(3)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, "player id contains unsupported characters");

export const gameResultSchema = z.object({
  gameId: gameIdSchema,
  score: z.number().int().min(0).max(1_000_000),
  durationMs: z.number().int().min(0).max(86_400_000),
  accuracy: z.number().min(0).max(1),
  solved: z.boolean(),
  at: z.string().max(64).optional(),
  detail: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
});

export const recordRequestSchema = z.object({
  result: gameResultSchema,
  opponentScore: z.number().int().min(0).max(1_000_000).optional(),
  isDraw: z.boolean().optional(),
  difficulty: z.enum(["easy", "medium", "hard", "expert"]).optional(),
  expectedMs: z.number().int().positive().max(3_600_000).optional(),
  isDaily: z.boolean().optional(),
});

export const profilePatchSchema = z
  .object({
    handle: z
      .string()
      .trim()
      .min(3)
      .max(24)
      .regex(/^[A-Za-z0-9_]+$/, "handle may only contain letters, digits and _"),
    displayName: z.string().trim().min(1).max(32),
    avatarSeed: z.string().max(64),
    country: z.string().length(2),
    college: z.string().max(80),
    bio: z.string().max(280),
  })
  .partial()
  .strict();

export const leaderboardQuerySchema = z.object({
  scope: z
    .enum(["global", "friends", "college"] satisfies LeaderboardScope[])
    .default("global"),
  category: z
    .enum(["blitz", "classical", "memory", "puzzle", "xp"] satisfies LeaderboardCategory[])
    .default("xp"),
});

export const itemIdSchema = z.string().min(1).max(64);
export const questIdSchema = z.string().min(1).max(64);

/** Parse or fail the request with a 400 that names the offending field. */
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const where = issue && issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  throw new HttpError(
    400,
    `${where}${issue?.message ?? "invalid request"}`,
    result.error.issues.map((entry) => ({
      path: entry.path.join("."),
      message: entry.message,
    })),
  );
}

export type RecordRequestInput = z.infer<typeof recordRequestSchema>;
export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
export type DifficultyInput = Difficulty;
