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
  measurement: string,
  fromTimestamp: number,
  downsampleSec: number
): ReadingRow[] {
  const d = getDb();
  if (downsampleSec === 0) {
    return d
      .prepare("SELECT timestamp, value FROM readings WHERE measurement = ? AND timestamp >= ? ORDER BY timestamp ASC")
      .all(measurement, fromTimestamp) as ReadingRow[];
  }
  const bucket = Math.floor(downsampleSec);
  return d
    .prepare(`
      SELECT (timestamp / ${bucket} * ${bucket}) AS ts, ROUND(AVG(value), 2) AS value
      FROM readings
      WHERE measurement = ? AND timestamp >= ?
      GROUP BY (timestamp / ${bucket})
      ORDER BY ts ASC
    `)
    .all(measurement, fromTimestamp)
    .map((row) => {
      const r = row as { ts: number; value: number };
      return { timestamp: r.ts, value: r.value };
    });
}

// Trend: compare avg of last 2 min vs avg of 2-4 min ago
const TREND_WINDOW_SEC = 120;  // 2 minutes
const DEADBAND: Record<string, number> = {
  co2: 5,
  temp: 0.3,
  umi: 1.0,
};

interface TrendRow {
  avg_value: number;
  cnt: number;
}

// TrendResult type is in types.ts for client import
import type { TrendResult } from "./types";

export function queryTrend(measurement: string): TrendResult {
  const d = getDb();
  const now = Math.floor(Date.now() / 1000);
  const t1 = now - TREND_WINDOW_SEC;         // 2 min ago
  const t2 = now - TREND_WINDOW_SEC * 2;     // 4 min ago

  const current = d.prepare(
    "SELECT AVG(value) as avg_value, COUNT(*) as cnt FROM readings WHERE measurement = ? AND timestamp >= ?"
  ).get(measurement, t1) as TrendRow | undefined;

  const previous = d.prepare(
    "SELECT AVG(value) as avg_value, COUNT(*) as cnt FROM readings WHERE measurement = ? AND timestamp >= ? AND timestamp < ?"
  ).get(measurement, t2, t1) as TrendRow | undefined;

  if (!current || !previous || current.cnt < 5 || previous.cnt < 5
      || current.avg_value === null || previous.avg_value === null) {
    return { direction: null, delta: 0 };
  }

  const delta = Math.round((current.avg_value - previous.avg_value) * 10) / 10;
  const deadband = DEADBAND[measurement] ?? 1;

  if (Math.abs(delta) < deadband) {
    return { direction: "stable", delta: 0 };
  }

  return { direction: delta > 0 ? "up" : "down", delta };
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
