import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { Pool, neonConfig } from "@neondatabase/serverless";
import { config as loadEnv } from "dotenv";
import { eq, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import * as schema from "../../src/db/schema";
import { user } from "../../src/db/schema";

neonConfig.webSocketConstructor = ws;

const envLocal = resolve(process.cwd(), ".env.local");
if (existsSync(envLocal)) {
  loadEnv({ path: envLocal });
}
loadEnv();

const SYSTEM_CURATOR_ID = "resker-curated-guides";

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const identifier = readArg("--identifier")?.trim().toLowerCase();
  const confirmed = process.argv.includes("--confirm");

  if (!identifier) {
    console.error("Usage: pnpm admin:delete-user -- --identifier <email-or-username> --confirm");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required.");
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle({ client: pool, schema });

  try {
    const [target] = await db
      .select({ id: user.id, name: user.name, email: user.email, username: user.username })
      .from(user)
      .where(or(eq(user.email, identifier), eq(user.username, identifier)))
      .limit(1);

    if (!target) {
      console.error(`User not found for identifier: ${identifier}`);
      process.exit(1);
    }

    if (target.id === SYSTEM_CURATOR_ID) {
      console.error("Refusing to delete system curated-guides account (resker-curated-guides).");
      process.exit(1);
    }

    if (!confirmed) {
      console.log(
        `[admin:delete-user] Dry run — found ${target.name} (@${target.username ?? "n/a"}, ${target.email}, id=${target.id}). Re-run with --confirm to delete.`,
      );
      return;
    }

    await db.delete(user).where(eq(user.id, target.id));
    console.log(
      `[admin:delete-user] Deleted user ${target.username ?? target.email} (${target.id}) and cascaded owned data.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[admin:delete-user] Failed:", err);
  process.exit(1);
});
