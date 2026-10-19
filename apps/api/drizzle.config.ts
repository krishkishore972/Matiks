import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 *
 * The schema belongs to `@repo/server` (both the API and the WS process read
 * it), while the generated SQL is committed next to that package so migrations
 * travel with the code rather than with one app. `pnpm --filter api db:generate`
 * runs from `apps/api`, which is also this file's directory.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "../../packages/server/src/db/schema.ts",
  out: "../../packages/server/drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://matiks:matiks@127.0.0.1:55432/matiks",
  },
  strict: false,
  verbose: true,
});
