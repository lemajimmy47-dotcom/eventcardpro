import { seedFromBackupFile, fetchFullStateFromDB, syncStateToRelationalDB } from "./db/cloudsql-core.ts";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "database.json");
let inMemoryDB: any = null;

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
  if (!process.env.SQL_HOST) {
    return getLocalDBFallback();
  }
  return await fetchFullStateFromDB();
}

export async function initDB() {
  // If SQL_HOST is not set, bypass completely to avoid slow connection timeouts during server startup
  if (!process.env.SQL_HOST) {
    console.log("[SQL Bypass] SQL_HOST is not set. Operating directly on local JSON database store.");
    inMemoryDB = getLocalDBFallback();
    return inMemoryDB;
  }

  console.log("[CloudSQL Initializer] Preparing Cloud SQL connection parameters...");
  try {
    // 1. If SQL database is empty, seed it from existing database.json
    await seedFromBackupFile();

    // 2. Read full state from PostgreSQL
    const state = await fetchFullStateFromDB();
    inMemoryDB = state;
    console.log("[CloudSQL Initializer] Cloud SQL PostgreSQL state fetched and loaded.");
    return inMemoryDB;
  } catch (error) {
    console.error("[CloudSQL Initializer] Setup failed: ", error);
    // Fallback safely to local JSON file
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

export async function readDBLatest() {
  if (!process.env.SQL_HOST) {
    if (!inMemoryDB) {
      inMemoryDB = getLocalDBFallback();
    }
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

  if (!process.env.SQL_HOST) {
    return;
  }

  // Sync / write directly to PostgreSQL!
  try {
    await syncStateToRelationalDB(data);
  } catch (error) {
    console.error("[CloudSQL writeDB] Relational sync error:", error);
    // Fail-safe so server operations (and HTTP responses) never block or error out
  }
}

export function triggerBackgroundSync() {
  // Relational writes are fully synchronous, background polling is not needed
}
