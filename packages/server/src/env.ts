/**
 * Configuration for both server processes.
 *
 * Read from the app's working directory (`.env` next to the `package.json` that
 * runs it), so `apps/api/.env` and `apps/ws/.env` stay independent while the
 * defaults still match `apps/api/docker-compose.yml`.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");

if (existsSync(envPath)) {
  for (const rawLine of readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    // Real environment variables always win over the file.
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://matiks:matiks@127.0.0.1:55432/matiks",
  /** Express HTTP API. */
  port: num(process.env.PORT, 4000),
  /** Raw WebSocket game server, a separate process. */
  wsPort: num(process.env.WS_PORT, 4001),
  botEligibleMs: num(process.env.BOT_ELIGIBLE_MS, 6000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  /** Daily/practice seeds are date-derived; the server is the clock of record. */
  dayKeyZone: process.env.DAY_KEY_ZONE ?? "UTC",
};
