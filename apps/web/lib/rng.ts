/**
 * Re-export of the shared RNG. The implementation lives in `packages/core` so
 * the server can generate the exact same boards from the same seed.
 */
export * from "@repo/core/rng";
