import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { Pool, neonConfig } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";
import { config as loadEnv } from "dotenv";
import { and, eq, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import * as schema from "../../src/db/schema";
import { account, session, user } from "../../src/db/schema";

neonConfig.webSocketConstructor = ws;

const envLocal = resolve(process.cwd(), ".env.local");
if (existsSync(envLocal)) {
  loadEnv({ path: envLocal });
}
loadEnv();

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const identifier = readArg("--identifier")?.trim().toLowerCase();
  const newPassword = readArg("--password");

  if (!identifier || !newPassword) {
    console.error(
      "Usage: pnpm admin:reset-password -- --identifier <email-or-username> --password <new-password>",
    );
    process.exit(1);
  }

  if (newPassword.length < 8 || newPassword.length > 128) {
    console.error("Error: password must be between 8 and 128 characters.");
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

    const passwordHash = await hashPassword(newPassword);

    await db.transaction(async (tx) => {
      const updated = await tx
        .update(account)
        .set({ password: passwordHash, updatedAt: new Date() })
        .where(and(eq(account.userId, target.id), eq(account.providerId, "credential")))
        .returning({ id: account.id });

      if (updated.length === 0) {
        await tx.insert(account).values({
          id: crypto.randomUUID(),
          accountId: target.id,
          providerId: "credential",
          userId: target.id,
          password: passwordHash,
        });
      }

      await tx.delete(session).where(eq(session.userId, target.id));
    });

    console.log(
      `[admin:reset-password] Password updated and active sessions cleared for ${target.username ?? target.email} (${target.id}).`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[admin:reset-password] Failed:", err);
  process.exit(1);
});
