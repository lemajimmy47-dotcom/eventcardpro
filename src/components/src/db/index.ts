import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

export const createPool = () => {
  const databaseUrl = process.env.DATABASE_URL || process.env.SQL_DATABASE_URL;

  if (databaseUrl) {
    console.log("[Database] Connecting using connection string (DATABASE_URL)...");
    const isLocal = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
    return new Pool({
      connectionString: databaseUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 10000,
      max: 10,
      keepAlive: true,
    });
  }

  const host = process.env.SQL_HOST;
  const user = process.env.SQL_USER;
  const password = process.env.SQL_PASSWORD;
  const database = process.env.SQL_DB_NAME;

  if (!host) {
    console.warn("[Database] SQL_HOST and DATABASE_URL are missing. Fallback to local storage expected.");
  } else {
    console.log(`[Database] Connecting to Postgres at ${host} as ${user} (DB: ${database})`);
  }

  const isUnixSocket = host && host.startsWith("/");

  return new Pool({
    host,
    port: 5432,
    user,
    password,
    database: database || "postgres",
    ssl: isUnixSocket ? false : (host ? { rejectUnauthorized: false } : false),
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    max: 15,
    keepAlive: true,
  });
};

const pool = createPool();

pool.on("error", (err) => {
  console.error("Unexpected error on idle SQL pool client:", err);
});

export const db = drizzle(pool, { schema });
export { schema };
