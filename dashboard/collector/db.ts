import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "iotnode.db");

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        measurement TEXT NOT NULL,
        value REAL NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_readings_measurement_ts ON readings(measurement, timestamp);
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
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

export function insertReading(measurement: string, value: number, timestamp: number): void {
  getDb().prepare("INSERT INTO readings (measurement, value, timestamp) VALUES (?, ?, ?)").run(measurement, value, timestamp);
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
