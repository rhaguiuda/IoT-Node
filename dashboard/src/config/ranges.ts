import type { RangeConfig, RangeId } from "@/lib/types";

export const RANGES: RangeConfig[] = [
  { id: "1m",  label: "1m",  seconds: 60,         downsampleSec: 0,   realtime: true },
  { id: "5m",  label: "5m",  seconds: 300,        downsampleSec: 0,   realtime: true },
  { id: "10m", label: "10m", seconds: 600,        downsampleSec: 0,   realtime: true },
  { id: "15m", label: "15m", seconds: 900,        downsampleSec: 0,   realtime: true },
  { id: "30m", label: "30m", seconds: 1800,       downsampleSec: 0,   realtime: true },
  { id: "1h",  label: "1h",  seconds: 3600,       downsampleSec: 0,   realtime: true },
  { id: "6h",  label: "6h",  seconds: 21600,      downsampleSec: 0,   realtime: true },
  { id: "12h", label: "12h", seconds: 43200,      downsampleSec: 5,   realtime: false },
  { id: "24h", label: "24h", seconds: 86400,      downsampleSec: 10,  realtime: false },
  { id: "3d",  label: "3d",  seconds: 259200,     downsampleSec: 30,  realtime: false },
  { id: "7d",  label: "7d",  seconds: 604800,     downsampleSec: 60,  realtime: false },
  { id: "14d", label: "14d", seconds: 1209600,    downsampleSec: 120, realtime: false },
  { id: "30d", label: "30d", seconds: 2592000,    downsampleSec: 300, realtime: false },
];

export const DEFAULT_RANGE: RangeId = "1h";

export function getRangeConfig(id: RangeId): RangeConfig {
  return RANGES.find((r) => r.id === id)!;
}
