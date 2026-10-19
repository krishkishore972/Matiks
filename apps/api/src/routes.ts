/**
 * The HTTP API.
 *
 * These are the endpoints that are simply "the player's data": profile, plays,
 * leaderboard, store, quests. Anything that is *live* (matchmaking, a running
 * duel, clock sync) goes over the WebSocket in `apps/ws`, because it is push,
 * not request/response.
 */
import { GAMES } from "@repo/core/catalog";
import { STORE_ITEMS } from "@repo/core/economy";
import {
  claimQuest,
  ensurePlayer,
  leaderboardFor,
  loadBundle,
  PUZZLE_TABS,
  purchaseItem,
  recordPlay,
  resetPlayer,
  updateProfile,
  type ProfileBundle,
} from "@repo/server/db/repo";
import { Router, type Request } from "express";import { parse, itemIdSchema, playerIdSchema, profilePatchSchema, questIdSchema, recordRequestSchema, leaderboardQuerySchema } from "./validation";

export const apiRouter: Router = Router();

/** The anonymous session id, validated before any route touches the database. */
function playerId(req: Request): string {
  return parse(playerIdSchema, req.header("x-player-id"));
}

async function withPlayer(req: Request, run: (id: string) => Promise<unknown>): Promise<unknown> {
  const id = playerId(req);
  await ensurePlayer(id);
  return run(id);
}

/* --------------------------------------------------------------- routes ---- */

apiRouter.get("/api/health", (_req, res) => {
  res.json({ ok: true, serverTime: Date.now() });
});

apiRouter.get("/api/catalog", (_req, res) => {
  res.json({ games: GAMES, store: STORE_ITEMS, puzzles: PUZZLE_TABS });
});

apiRouter.post("/api/player", async (req, res) => {
  res.json(await withPlayer(req, (id) => loadBundle(id)));
});

apiRouter.get("/api/player", async (req, res) => {
  res.json(await withPlayer(req, (id) => loadBundle(id)));
});

apiRouter.patch("/api/player", async (req, res) => {
  const patch = parse(profilePatchSchema, req.body);
  res.json(await withPlayer(req, (id) => updateProfile(id, patch)));
});

apiRouter.post("/api/player/reset", async (req, res) => {
  res.json(await withPlayer(req, (id) => resetPlayer(id)));
});

apiRouter.post("/api/plays", async (req, res) => {
  const request = parse(recordRequestSchema, req.body);
  res.json(
    await withPlayer(req, (id) =>
      recordPlay(id, {
        ...request,
        // `at` is optional on the wire and required by the domain; the server
        // clock is the one of record anyway.
        result: { ...request.result, at: request.result.at ?? new Date().toISOString() },
      }),
    ),
  );
});

apiRouter.get("/api/leaderboard", async (req, res) => {
  const query = parse(leaderboardQuerySchema, req.query);
  res.json(
    await withPlayer(req, (id) => leaderboardFor(query.scope, query.category, id)),
  );
});

apiRouter.post("/api/store/:itemId", async (req, res) => {
  const itemId = parse(itemIdSchema, req.params.itemId);
  res.json(await withPlayer(req, (id) => purchaseItem(id, itemId)));
});

apiRouter.post("/api/quests/:questId/claim", async (req, res) => {
  const questId = parse(questIdSchema, req.params.questId);
  res.json(await withPlayer(req, (id) => claimQuest(id, questId)));
});

/** A convenience re-export for tests and the smoke script. */
export type { ProfileBundle };
