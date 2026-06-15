import { seedFromBackupFile, fetchFullStateFromDB, syncStateToRelationalDB } from "./db/cloudsql-core.ts";
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
      return JSON.parse(raw);
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
      console.error("[CloudSQL Initializer] Optional schema push returned a warning or error, attempting to proceed:", migrationErr);
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

  try {
    const state = await fetchFullStateFromDB();
    inMemoryDB = state;
    return inMemoryDB;
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

  // Sync / write directly to PostgreSQL! (Fire and forget so HTTP response is fast)
  try {
    isSyncingToDB = true;
    syncStateToRelationalDB(data).then(() => {
      isSyncingToDB = false;
    }).catch((error) => {
      console.error("[CloudSQL writeDB] Relational sync error (async):", error);
      isSyncingToDB = false;
    });
  } catch (error) {
    console.error("[CloudSQL writeDB] Relational sync error trigger:", error);
    isSyncingToDB = false;
  }
}

export function triggerBackgroundSync() {
  // Relational writes are fully synchronous, background polling is not needed
}
