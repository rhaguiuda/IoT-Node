import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "iotnode.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true });
    db.pragma("journal_mode = WAL");
  }
  return db;
}

interface ReadingRow {
  timestamp: number;
  value: number;
}

export function queryReadings(
  sensor: string,
  measurement: string,
  fromTimestamp: number,
  downsampleSec: number
): ReadingRow[] {
  const d = getDb();
  if (downsampleSec === 0) {
    return d
      .prepare("SELECT timestamp, value FROM readings WHERE sensor = ? AND measurement = ? AND timestamp >= ? ORDER BY timestamp ASC")
      .all(sensor, measurement, fromTimestamp) as ReadingRow[];
  }
  return d
    .prepare(`
      SELECT (timestamp / ? * ?) AS timestamp, AVG(value) AS value
      FROM readings
      WHERE sensor = ? AND measurement = ? AND timestamp >= ?
      GROUP BY timestamp / ?
      ORDER BY timestamp ASC
    `)
    .all(downsampleSec, downsampleSec, sensor, measurement, fromTimestamp, downsampleSec) as ReadingRow[];
}

export function getAllSettings(): Record<string, string> {
  const d = getDb();
  const rows = d.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

export function updateSettings(updates: Record<string, string>): void {
  const writableDb = new Database(DB_PATH);
  writableDb.pragma("journal_mode = WAL");
  const stmt = writableDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  for (const [k, v] of Object.entries(updates)) stmt.run(k, v);
  writableDb.close();
}
