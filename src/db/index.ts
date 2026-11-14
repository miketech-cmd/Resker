import "server-only";

import { Pool, neon, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleHttp, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless, type NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";

import * as schema from "./schema";

neonConfig.webSocketConstructor = ws;

type HttpDb = NeonHttpDatabase<typeof schema>;
type PoolDb = NeonDatabase<typeof schema>;

let _httpDb: HttpDb | undefined;
let _pool: Pool | undefined;
let _poolDb: PoolDb | undefined;

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add your Neon Postgres connection string to .env.local or Vercel Environment Variables.",
    );
  }
  return url;
}

/** Fast HTTP Drizzle client for single-query reads and `db.batch()` writes. */
export function getDb(): HttpDb {
  if (!_httpDb) {
    const sql = neon(getDatabaseUrl());
    _httpDb = drizzleHttp({ client: sql, schema });
  }
  return _httpDb;
}

/** WebSocket-backed Drizzle client for interactive multi-step ACID transactions. */
export function getPoolDb(): PoolDb {
  if (!_poolDb) {
    _pool = new Pool({ connectionString: getDatabaseUrl() });
    _poolDb = drizzleServerless({ client: _pool, schema });
  }
  return _poolDb;
}

export const db: HttpDb = new Proxy({} as HttpDb, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export const dbPool: PoolDb = new Proxy({} as PoolDb, {
  get(_target, prop, receiver) {
    return Reflect.get(getPoolDb(), prop, receiver);
  },
});
