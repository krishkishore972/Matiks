/**
 * Shared domain core.
 *
 * The scoring rules, RNG and domain types are the part of this project that both
 * the web client and the server must agree on exactly: the server is
 * authoritative, and the client predicts. Keeping one copy here is what stops
 * the two from drifting apart.
 *
 * Evidence for the rules lives in `src/scoring.ts` and in
 * `docs/reference/gameplay-notes.md`.
 */
export * from "./rng";
export * from "./types";
export * from "./scoring";
export * from "./quests";
export * from "./catalog";
export * from "./economy";
export * from "./leaderboard";
export * from "./protocol";
