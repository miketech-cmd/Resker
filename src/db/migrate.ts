import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { neon } from "@neondatabase/serverless";
import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const envLocal = resolve(process.cwd(), ".env.local");
if (existsSync(envLocal)) {
  loadEnv({ path: envLocal });
}
loadEnv();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.env.VERCEL && !process.env.VERCEL_ENV) {
      console.warn("[db:migrate] Skipping migration: DATABASE_URL is not set.");
      return;
    }
    throw new Error("DATABASE_URL is required to run migrations.");
  }

  const sql = neon(url);
  const db = drizzle({ client: sql });

  console.log("[db:migrate] Applying migrations from ./drizzle ...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[db:migrate] Migrations complete.");
}

main().catch((err) => {
  console.error("[db:migrate] Failed:", err);
  process.exit(1);
});
