"use client";

import MaterialIcon from "@/components/MaterialIcon";
import type { TrendDirection } from "@/lib/types";

interface TrendIndicatorProps {
  direction: TrendDirection;
  delta: number;
  measurement: string;
  unit: string;
}

function getTrendColor(direction: TrendDirection, measurement: string): string {
  if (direction === "stable" || direction === null) return "var(--text-tertiary)";

  // CO2: up is bad, down is good
  if (measurement === "co2") {
    return direction === "up" ? "var(--danger)" : "var(--success)";
  }
  // Temp and humidity: up is warning (orange), down is info (blue)
  return direction === "up" ? "var(--warning)" : "var(--info)";
}

function getIconName(direction: TrendDirection): string {
  if (direction === "up") return "trending_up";
  if (direction === "down") return "trending_down";
  return "trending_flat";
}

function formatDelta(delta: number, measurement: string): string {
  if (measurement === "co2") return `${delta > 0 ? "+" : ""}${Math.round(delta)}`;
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
}

export default function TrendIndicator({ direction, delta, measurement, unit }: TrendIndicatorProps) {
  if (direction === null) return null;

  const color = getTrendColor(direction, measurement);

  return (
    <span className="inline-flex items-center gap-1" style={{ color }}>
      <MaterialIcon name={getIconName(direction)} size={22} color={color} />
      {direction !== "stable" && (
        <span className="text-[15px] font-semibold tabular-nums">
          {formatDelta(delta, measurement)}{unit}
        </span>
      )}
    </span>
  );
}
