export interface Reading {
  timestamp: number;
  value: number;
}

export interface SensorData {
  co2: Reading[];
  temp: Reading[];
  umi: Reading[];
}

export interface RealtimeValues {
  co2: number | null;
  temp: number | null;
  umi: number | null;
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

export type RangeId = "1m" | "5m" | "10m" | "15m" | "30m" | "1h" | "6h" | "12h" | "24h" | "3d" | "7d" | "14d" | "30d" | "60d" | "90d";

export interface RangeConfig {
  id: RangeId;
  label: string;
  seconds: number;
  downsampleSec: number;
  realtime: boolean;
}
