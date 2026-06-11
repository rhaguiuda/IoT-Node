import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "iotnode.db");

// Device id used to backfill rows that predate multi-device support — these
// were all produced by the single original node publishing on .../1/...
export const LEGACY_DEVICE_ID = "1";

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL DEFAULT '${LEGACY_DEVICE_ID}',
        measurement TEXT NOT NULL,
        value REAL NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS devices (
        device_id  TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        first_seen INTEGER NOT NULL,
        last_seen  INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Must run before the device_id index is created: on an old DB the column
    // does not exist yet, so indexing it would fail.
    migrateToMultiDevice(db);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_readings_device_measurement_ts
        ON readings(device_id, measurement, timestamp);
    `);

    const defaults: Record<string, string> = {
      co2_threshold: "1000",
      offline_timeout: "5",
      pushover_user_key: "",
      pushover_api_token: "",
      alerts_enabled: "true",
      alert_cooldown: "15",
      theme: "dark",
    };
    const insert = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
    for (const [k, v] of Object.entries(defaults)) {
      insert.run(k, v);
    }
  }
  return db;
}

// Idempotent migration for databases created before multi-device support.
// A fresh DB already has device_id (from CREATE TABLE above) and skips the
// ALTER. An old prod DB lacks the column: add it, backfill existing rows with
// the legacy id, and register the legacy device so the dashboard lists it.
function migrateToMultiDevice(database: Database.Database): void {
  const cols = database.prepare("PRAGMA table_info(readings)").all() as { name: string }[];
  const hasDeviceId = cols.some((c) => c.name === "device_id");

  if (!hasDeviceId) {
    database.exec(
      `ALTER TABLE readings ADD COLUMN device_id TEXT NOT NULL DEFAULT '${LEGACY_DEVICE_ID}'`,
    );
    console.log(`[MIGRATION] Added device_id to readings, backfilled '${LEGACY_DEVICE_ID}'`);
  }

  // Register the legacy device if there is legacy data but no devices row yet.
  const legacyCount = database
    .prepare("SELECT COUNT(*) AS n FROM readings WHERE device_id = ?")
    .get(LEGACY_DEVICE_ID) as { n: number };
  if (legacyCount.n > 0) {
    const bounds = database
      .prepare(
        "SELECT MIN(timestamp) AS first, MAX(timestamp) AS last FROM readings WHERE device_id = ?",
      )
      .get(LEGACY_DEVICE_ID) as { first: number | null; last: number | null };
    if (bounds.first !== null && bounds.last !== null) {
      database
        .prepare(
          `INSERT OR IGNORE INTO devices (device_id, name, first_seen, last_seen)
           VALUES (?, ?, ?, ?)`,
        )
        .run(LEGACY_DEVICE_ID, LEGACY_DEVICE_ID, bounds.first, bounds.last);
    }
  }
}

export function insertReading(
  deviceId: string,
  measurement: string,
  value: number,
  timestamp: number,
): void {
  getDb()
    .prepare(
      "INSERT INTO readings (device_id, measurement, value, timestamp) VALUES (?, ?, ?, ?)",
    )
    .run(deviceId, measurement, value, timestamp);
}

// Register a device on first contact (name defaults to its id) and bump
// last_seen on every message. Name is preserved once a user renames it.
export function upsertDevice(deviceId: string, timestamp: number): void {
  getDb()
    .prepare(
      `INSERT INTO devices (device_id, name, first_seen, last_seen)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET last_seen = excluded.last_seen`,
    )
    .run(deviceId, deviceId, timestamp, timestamp);
}

export function getDeviceName(deviceId: string): string {
  const row = getDb()
    .prepare("SELECT name FROM devices WHERE device_id = ?")
    .get(deviceId) as { name: string } | undefined;
  return row?.name ?? deviceId;
}

export function getKnownDeviceIds(): string[] {
  const rows = getDb().prepare("SELECT device_id FROM devices").all() as { device_id: string }[];
  return rows.map((r) => r.device_id);
}

export function getSetting(key: string): string | undefined {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value;
}

export function purgeOldReadings(): void {
  const cutoff = Math.floor(Date.now() / 1000) - 86400 * 90;
  const result = getDb().prepare("DELETE FROM readings WHERE timestamp < ?").run(cutoff);
  if (result.changes > 0) {
    console.log(`[PURGE] Deleted ${result.changes} readings older than 90 days`);
  }
}
