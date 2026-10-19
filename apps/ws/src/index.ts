/**
 * The Matiks live game server.
 *
 * A separate process from the HTTP API: Postgres is the only shared state, so
 * either can restart without taking the other down. It waits for the schema to
 * exist before accepting sockets (the API applies migrations on boot), and
 * refuses to start with a readable message when Postgres is unreachable.
 */
import { closeDb, db } from "@repo/server/db";
import { games } from "@repo/server/db/schema";
import { env } from "@repo/server/env";
import { createWsServer } from "./hub";

async function waitForSchema(timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await db.select({ id: games.id }).from(games).limit(1);
      return;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

async function main(): Promise<void> {
  try {
    await waitForSchema();
  } catch (error) {
    console.error(
      `\nCannot reach the Matiks schema at ${env.databaseUrl}\n` +
        `Start Postgres with:  pnpm --filter api db:up\n` +
        `Apply the schema:     pnpm --filter api migrate\n`,
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
    return;
  }

  const server = createWsServer();
  server.wss.on("listening", () => {
    console.log(`matiks ws listening on ws://localhost:${env.wsPort}`);
    console.log(`  cors origin ${env.corsOrigin}`);
  });

  const shutdown = (): void => {
    console.log("\nshutting down");
    void server
      .close()
      .then(() => closeDb())
      .then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main();
