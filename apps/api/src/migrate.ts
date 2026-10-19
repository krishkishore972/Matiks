/**
 * Apply pending migrations, then exit.
 *
 * `pnpm --filter api migrate`; the API also runs this on boot, so the standalone
 * command is for CI and for preparing the database before the WS process starts.
 */
import { closeDb } from "@repo/server/db";
import { migrate } from "@repo/server/db/migrate";

try {
  await migrate();
  console.log("migrations applied");
} catch (error) {
  console.error("migration failed:", error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
