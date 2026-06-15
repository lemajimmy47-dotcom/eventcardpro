import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

export const createPool = () => {
  const host = process.env.SQL_HOST;
  const user = process.env.SQL_USER;
  const password = process.env.SQL_PASSWORD;
  const database = process.env.SQL_DB_NAME;

  if (!host) {
    console.warn("[Database] SQL_HOST is missing. Fallback to local storage expected.");
  } else {
    console.log(`[Database] Connecting to Postgres at ${host} as ${user} (DB: ${database})`);
  }

  return new Pool({
    host,
    user,
    password,
    database: database || "postgres",
    connectionTimeoutMillis: 60000,
    idleTimeoutMillis: 30000,
    max: 10,
  });
};

const pool = createPool();

pool.on("error", (err) => {
  console.error("Unexpected error on idle SQL pool client:", err);
});

export const db = drizzle(pool, { schema });
export { schema };
