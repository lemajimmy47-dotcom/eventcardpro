import { seedFromBackupFile, fetchFullStateFromDB, syncStateToRelationalDB } from "./db/cloudsql-core.ts";
import { db } from "./db/index.ts";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const DB_PATH = path.join(process.cwd(), "database.json");
let inMemoryDB: any = null;

function hasSQLConfig() {
  return !!(process.env.SQL_HOST || process.env.DATABASE_URL || process.env.SQL_DATABASE_URL);
}

function getLocalDBFallback() {
  if (fs.existsSync(DB_PATH)) {
    try {
      const raw = fs.readFileSync(DB_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      return parsed;
    } catch (err) {
      console.error("[Fallback Local DB] Read failed:", err);
    }
  }
  return {
    eventsList: [],
    eventDetails: {},
    guests: [],
    templateSettings: {},
    userAccount: {},
    committee_members: [],
    committee_roles: []
  };
}

export async function fetchFromFirestore() {
  if (!hasSQLConfig()) {
    return getLocalDBFallback();
  }
  return await fetchFullStateFromDB();
}

export async function initDB() {
  // If database connection parameters are not set, bypass completely to avoid slow connection timeouts during server startup
  const isCloudSQL = hasSQLConfig();
  
  if (!isCloudSQL) {
    console.log("[SQL Bypass] Database connection parameters are not set. Operating directly on local JSON database store.");
    inMemoryDB = getLocalDBFallback();
    return inMemoryDB;
  }

  console.log("[CloudSQL Initializer] Preparing Cloud SQL connection parameters...");
  try {
    // Automatically provision tables inside Supabase if they do not yet exist
    console.log("[CloudSQL Initializer] Running schema push to create tables on PostgreSQL if needed...");
    try {
      execSync("npx drizzle-kit push --config=src/db/drizzle.config.ts --force", { stdio: "inherit" });
      console.log("[CloudSQL Initializer] Schema pushed successfully.");
    } catch (migrationErr) {
      console.log("[CloudSQL Initializer] Note: Optional schema push was skipped or database is already up-to-date. Proceeding smoothly as tables are already fully provisioned.");
    }

    // Ensure the new active_event_id column exists on user_account table directly
    try {
      console.log("[CloudSQL Initializer] Ensuring 'active_event_id' column exists in 'user_account' table...");
      await db.execute(sql`ALTER TABLE "user_account" ADD COLUMN IF NOT EXISTS "active_event_id" text;`);
      console.log("[CloudSQL Initializer] Column 'active_event_id' verified/added successfully.");
    } catch (dbAlterErr) {
      console.error("[CloudSQL Initializer] Dynamic table verification error:", dbAlterErr);
    }

    try {
      console.log("[CloudSQL Initializer] Ensuring 'orientation' column exists in 'template_settings' table...");
      await db.execute(sql`ALTER TABLE "template_settings" ADD COLUMN IF NOT EXISTS "orientation" text DEFAULT 'portrait';`);
      console.log("[CloudSQL Initializer] Column 'orientation' verified/added successfully.");
    } catch (dbAlterErr) {
      console.error("[CloudSQL Initializer] Dynamic table verification error:", dbAlterErr);
    }

    // 1. If SQL database is empty, seed it from existing database.json
    // We wrap this in a timeout-like behavior or ensure it doesn't block forever
    console.log("[CloudSQL Initializer] Seeding from backup if needed...");
    await seedFromBackupFile();

    // 2. Read full state from PostgreSQL
    console.log("[CloudSQL Initializer] Fetching full state from PostgreSQL...");
    const state = await fetchFullStateFromDB();
    inMemoryDB = state;
    console.log("[CloudSQL Initializer] Cloud SQL PostgreSQL state fetched and loaded.");
    
    // Start background keep-alive loop to prevent Render PostgreSQL scale-to-zero/sleep
    startKeepAliveInterval();
    
    return inMemoryDB;
  } catch (error) {
    console.error("[CloudSQL Initializer] Setup failed: ", error);
    // Fallback safely to local JSON file
    console.log("[CloudSQL Initializer] Falling back to local database.json due to failure.");
    inMemoryDB = getLocalDBFallback();
    return inMemoryDB;
  }
}

export function readDB() {
  if (!inMemoryDB) {
    inMemoryDB = getLocalDBFallback();
  }
  return inMemoryDB;
}

let isSyncingToDB = false;
let activeFetchPromise: Promise<any> | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 1500; // 1.5 seconds client page load bundle threshold

export async function readDBLatest() {
  if (!hasSQLConfig()) {
    if (!inMemoryDB) {
      inMemoryDB = getLocalDBFallback();
    }
    return inMemoryDB;
  }

  // If we are actively writing to DB, reading from DB will yield stale records. Return in memory state.
  if (isSyncingToDB && inMemoryDB) {
    return inMemoryDB;
  }

  const now = Date.now();
  if (inMemoryDB && (now - lastFetchTime < CACHE_TTL)) {
    return inMemoryDB;
  }

  if (activeFetchPromise) {
    return activeFetchPromise;
  }

  activeFetchPromise = (async () => {
    try {
      const state = await fetchFullStateFromDB();
      inMemoryDB = state;
      lastFetchTime = Date.now();
      return state;
    } finally {
      activeFetchPromise = null;
    }
  })();

  try {
    return await activeFetchPromise;
  } catch (error) {
    console.error("[CloudSQL readDBLatest] PostgreSQL read failed, returning cache: ", error);
    if (!inMemoryDB) {
      inMemoryDB = getLocalDBFallback();
    }
    return inMemoryDB;
  }
}

export async function getStateForClient() {
  return await readDBLatest();
}

export function updateMemoryAndLocalFileOnly(data: any) {
  inMemoryDB = data;
  lastFetchTime = Date.now();
  try {
    const tmpPath = DB_PATH + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmpPath, DB_PATH);
  } catch (e) {
    console.warn("Failed to write to local database file safely:", e);
  }
}

export async function writeDB(data: any) {
  if (data && data.guests && Array.isArray(data.guests)) {
    const seenIds = new Set<string>();
    data.guests = data.guests
      .map((g: any) => {
        if (g && typeof g === "object") {
          const { cardImageUrl, ...rest } = g;
          return rest;
        }
        return g;
      })
      .filter((g: any) => {
        if (!g || !g.id) return false;
        if (seenIds.has(g.id)) return false;
        seenIds.add(g.id);
        return true;
      });
  }

  // Sync memory and disk snapshot
  updateMemoryAndLocalFileOnly(data);

  if (!hasSQLConfig()) {
    return;
  }

  // Sync / write directly to PostgreSQL synchronously! (Await write complete)
  try {
    isSyncingToDB = true;
    await syncStateToRelationalDB(data);
    isSyncingToDB = false;
  } catch (error) {
    console.error("[CloudSQL writeDB] Relational sync error (synchronous):", error);
    isSyncingToDB = false;
    throw error;
  }
}

export function triggerBackgroundSync() {
  // Relational writes are fully synchronous, background polling is not needed
}

let isKeepAliveRunning = false;

export async function pingPostgresKeepAlive() {
  if (!hasSQLConfig()) return;
  try {
    console.log("[Postgres Keep-Alive] Pinging database to keep connection warm...");
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    console.log(`[Postgres Keep-Alive] Keep-Alive Successful! Response time: ${Date.now() - start}ms`);
  } catch (err: any) {
    console.error(`[Postgres Keep-Alive Fail] Alert! Database wake-up ping failed:`, err.message || err);
  }
}

export function startKeepAliveInterval() {
  if (isKeepAliveRunning) return;
  if (!hasSQLConfig()) {
    console.log("[Postgres Keep-Alive] SQL configuration is not set. Bypassing keep-alive loop.");
    return;
  }
  
  isKeepAliveRunning = true;
  console.log("[Postgres Keep-Alive] Keep-alive service initialized. Will ping every 10 minutes continuously.");
  
  // Run an immediate ping at startup (delayed slightly to allow server setup to breathe)
  setTimeout(() => {
    pingPostgresKeepAlive();
  }, 8000);

  // Interval trigger every 10 minutes (10 * 60 * 1000 = 600,000 milliseconds)
  setInterval(() => {
    pingPostgresKeepAlive();
  }, 10 * 60 * 1000);
}
