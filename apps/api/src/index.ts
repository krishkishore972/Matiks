/**
 * The Matiks HTTP API.
 *
 * Boot order matters: the schema is applied first (so a fresh clone is one
 * command), then the bot roster is seeded (so leaderboards are not empty), and
 * only then does the listener open. If Postgres is unreachable the process exits
 * with a readable message rather than a stack trace, because the most common
 * failure by far is "forgot to start Docker".
 *
 * The live game channel is a separate process (`apps/ws`); this one is only the
 * request/response surface.
 */
import { closeDb, pingDatabase } from "@repo/server/db";
import { migrate } from "@repo/server/db/migrate";
import { seedBots } from "@repo/server/db/repo";
import { env } from "@repo/server/env";
import { createApp } from "./app";

async function main(): Promise<void> {
  try {
    await pingDatabase();
  } catch (error) {
    console.error(
      `\nCannot reach Postgres at ${env.databaseUrl}\n` +
        `Start it with:  pnpm --filter api db:up\n` +
        `Then re-run:    pnpm --filter api dev\n`,
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
    return;
  }

  await migrate();
  const seeded = await seedBots();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`matiks api listening on http://localhost:${env.port}`);
    console.log(`  websocket   ws://localhost:${env.wsPort} (apps/ws)`);
    console.log(`  cors origin ${env.corsOrigin}`);
    console.log(`  alpha bots  ${seeded > 0 ? `seeded ${seeded}` : "already present"}`);
  });

  const shutdown = (): void => {
    console.log("\nshutting down");
    server.close(() => {
      void closeDb().then(() => process.exit(0));
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main();
