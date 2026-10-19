/**
 * Drop and rebuild the development database.
 *
 * The pre-Drizzle schema was applied by `schema.sql`, so those databases have
 * tables but no `__drizzle_migrations` history; an initial migration would
 * collide with them. This is the one-time bridge (and a handy reset while
 * developing): `pnpm --filter api db:reset`.
 *
 * Refuses to run when NODE_ENV is `production`.
 */
import { closeDb, pool } from "@repo/server/db";
import { migrate } from "@repo/server/db/migrate";

if (process.env.NODE_ENV === "production") {
  console.error("refusing to drop the schema with NODE_ENV=production");
  process.exit(1);
}

try {
  await pool.query("drop schema if exists public cascade");
  await pool.query("create schema public");
  await migrate();
  console.log("database reset and migrations applied");
} catch (error) {
  console.error("reset failed:", error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
