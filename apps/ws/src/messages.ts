/**
 * The WebSocket wire format, validated with Zod.
 *
 * The message *vocabulary* is the shipped one (`searchOpponentV3`,
 * `pollSearchV3`, `abortSearchTicketV3`, `startGameV3`,
 * `submitGameQuestionActions`, `resignGameV3`, `replayGameStreamV3`,
 * `syncServerTime`), carried as JSON. Nothing from a socket is trusted: the
 * parsed result is the only thing the hub sees, so an extra field or a wrong
 * type is rejected here rather than surfacing as a database error later.
 */
import { GAMES } from "@repo/core/catalog";
import type { GameId } from "@repo/core/types";
import { z } from "zod";

const GAME_IDS = Object.keys(GAMES) as [GameId, ...GameId[]];

export const gameIdSchema = z.enum(GAME_IDS);
export const playerIdSchema = z
  .string()
  .min(3)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);

/** An opaque id (game row or ticket), not a mode id. */
const opaqueId = z.string().min(1).max(64);

export const clientMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("hello"), playerId: playerIdSchema }),
  z.object({
    t: z.literal("search"),
    gameId: gameIdSchema,
    rated: z.boolean().optional(),
  }),
  z.object({ t: z.literal("poll"), ticketId: opaqueId }),
  z.object({ t: z.literal("abort"), ticketId: opaqueId }),
  z.object({ t: z.literal("start"), gameId: opaqueId }),
  z.object({
    t: z.literal("answer"),
    gameId: opaqueId,
    answer: z.object({
      index: z.number().int().min(0).max(10_000),
      answer: z.union([z.number(), z.string().max(32)]),
      elapsedMs: z.number().min(0).max(600_000),
    }),
  }),
  z.object({ t: z.literal("finish"), gameId: opaqueId }),
  z.object({ t: z.literal("resign"), gameId: opaqueId }),
  z.object({
    t: z.literal("replay"),
    gameId: opaqueId,
    sinceStreamId: z.number().int().min(0),
  }),
  z.object({
    t: z.literal("syncTime"),
    clientRequestTime: z.number().int().min(0),
  }),
]);

export type ClientMessageInput = z.infer<typeof clientMessageSchema>;

export type ParseResult =
  | { ok: true; message: ClientMessageInput }
  | { ok: false; error: string };

export function parseClientMessage(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "malformed message" };
  }

  const parsed = clientMessageSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue && issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return {
      ok: false,
      error: `${where}${issue?.message ?? "invalid message"}`,
    };
  }

  return { ok: true, message: parsed.data };
}
