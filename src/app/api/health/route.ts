import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await db.execute(sql`SELECT 1 AS ok`);
    const row = result.rows[0] as { ok?: number } | undefined;

    if (!row || row.ok !== 1) {
      return NextResponse.json(
        { ok: false, error: "Unexpected database response" },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { ok: true, db: "connected" },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database check failed";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
