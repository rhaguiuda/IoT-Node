export interface Reading {
  timestamp: number;
  value: number;
}

export interface SensorData {
  scd41: { co2: Reading[]; temp: Reading[]; umi: Reading[] };
  ens160: { eco2: Reading[]; tvoc: Reading[]; airq: Reading[] };
  sht4x: { temp: Reading[]; umi: Reading[] };
  bh1750: { lux: Reading[] };
}

export interface RealtimeValues {
  scd41: { co2: number | null; temp: number | null; umi: number | null };
  ens160: { eco2: number | null; tvoc: number | null; airq: number | null };
  sht4x: { temp: number | null; umi: number | null };
  bh1750: { lux: number | null };
}

export type ThresholdLevel = "success" | "warning" | "danger" | "info";

export interface ThresholdResult {
  level: ThresholdLevel;
  label: string;
}

export interface Settings {
  co2_threshold: number;
  offline_timeout: number;
  pushover_user_key: string;
  pushover_api_token: string;
  alerts_enabled: boolean;
  alert_cooldown: number;
  theme: string;
}

export type RangeId = "1m" | "5m" | "10m" | "15m" | "30m" | "1h" | "6h" | "12h" | "24h" | "3d" | "7d" | "14d" | "30d";

export interface RangeConfig {
  id: RangeId;
  label: string;
  seconds: number;
  downsampleSec: number;
  realtime: boolean;
}
