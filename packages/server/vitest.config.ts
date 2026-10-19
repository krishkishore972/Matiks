import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The duel tests talk to a real Postgres (see apps/api/docker-compose.yml);
    // the pure question tests do not. `fileParallelism: false` keeps the
    // database tests from fighting over the same games.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
