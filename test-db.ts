import { createPool } from "./src/db/index.ts";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./src/db/schema.ts";

async function test() {
  const pool = createPool();
  const db = drizzle(pool, { schema });
  
  console.log("Testing connection...");
  try {
    const result = await db.execute(sql`SELECT 1`);
    console.log("Connection successful:", result);
  } catch (e) {
    console.error("Connection failed:", e);
  } finally {
    await pool.end();
  }
}

test();
