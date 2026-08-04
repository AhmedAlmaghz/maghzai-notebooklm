import { db } from "@/db";
import { sql } from "drizzle-orm";
import { IS_POSTGRES } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (IS_POSTGRES) {
      await db.execute(sql`select 1`);
    } else {
      // SQLite drizzle instance uses .run() instead of .execute()
      await (db as any).run(sql`select 1`);
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
