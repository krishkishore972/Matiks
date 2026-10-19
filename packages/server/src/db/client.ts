/**
 * The one Drizzle client for a process.
 *
 * `pg` returns `bigint` columns as strings by default, which would leak `"12"`
 * into JSON where the client expects a number; the int8 parser is narrowed to
 * `Number` (safe here: counters stay far below 2^53).
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import { env } from "../env";

pg.types.setTypeParser(pg.types.builtins.INT8, (value: string) => Number(value));

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
});

// Drizzle 1.0 takes a single config object and its `relations` config replaced
// the old `schema` option; the query builder is fully typed from the table
// objects themselves. Passing the pool positionally would be read as a
// connection config and silently create a second, unconfigured pool.
export const db = drizzle({ client: pool });

export type Database = typeof db;

/** A transaction handle, as handed to `db.transaction(callback)`. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Anything that can run a query: the client or an open transaction. */
export type Executor = Database | Transaction;

export async function closeDb(): Promise<void> {
  await pool.end();
}

/** A cheap connectivity probe for boot-time error messages. */
export async function pingDatabase(): Promise<void> {
  await db.execute(sql`select 1`);
}
