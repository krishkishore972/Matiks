/**
 * Server-side domain, shared by the two processes.
 *
 * `apps/api` serves the request/response surface (Express) and `apps/ws` serves
 * the live one (raw WebSocket). Both validate with Zod and both read and write
 * through this package, so the rules cannot drift between them.
 */
export * from "./env";
export * from "./db/client";
export * from "./db/schema";
export * from "./db/repo";
export * from "./db/migrate";
export * from "./domain/questions";
export * from "./domain/stream";
export * from "./domain/duel";
export * from "./domain/matchmaking";
