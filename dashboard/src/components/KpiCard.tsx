"use client";

import MaterialIcon from "@/components/MaterialIcon";
import CountUp from "@/components/animation/CountUp";
import StatusBadge from "@/components/StatusBadge";
import TrendIndicator from "@/components/TrendIndicator";
import Co2ScaleInfo from "@/components/Co2ScaleInfo";
import { getThreshold } from "@/lib/thresholds";
import type { TrendResult } from "@/lib/types";

interface KpiCardProps {
  iconName: string;
  value: number | null;
  label: string;
  unit: string;
  measurement: string;
  iconColor: string;
  trend?: TrendResult;
}

export default function KpiCard({
  iconName,
  value,
  label,
  unit,
  measurement,
  iconColor,
  trend,
}: KpiCardProps) {
  const threshold = value !== null ? getThreshold(measurement, value) : null;
  const needsDecimal = measurement === "temp" || measurement === "umi";
  const decimals = needsDecimal ? 1 : 0;

  return (
    <div
      className="h-full relative overflow-hidden"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${iconColor}`,
        borderRadius: "var(--card-radius)",
        boxShadow: "var(--card-shadow)",
        padding: "20px",
      }}
    >
      {/* Ghost icon background */}
      <div className="absolute -top-1 -right-1 pointer-events-none" style={{ opacity: 0.08 }}>
        <MaterialIcon name={iconName} size={64} color={iconColor} />
      </div>

      {/* Label + info icon */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <span
          className="text-[10px] font-medium uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          {label}
        </span>
        {measurement === "co2" && <Co2ScaleInfo />}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-[36px] font-bold tracking-tight leading-none tabular-nums"
          style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-2px" }}
        >
          {value !== null ? (
            <CountUp value={value} decimals={decimals} duration={0.5} />
          ) : (
            <span style={{ color: "var(--text-tertiary)" }}>--</span>
          )}
        </span>
        {value !== null && unit && (
          <span className="text-[13px] font-medium" style={{ color: "var(--text-tertiary)" }}>
            {unit}
          </span>
        )}
      </div>

      {/* Badge + Trend */}
      <div className="mt-3 flex items-center justify-between">
        <div className="min-h-[22px]">
          {threshold && threshold.label ? (
            <StatusBadge level={threshold.level} label={threshold.label} />
          ) : null}
        </div>
        {trend && (
          <TrendIndicator
            direction={trend.direction}
            delta={trend.delta}
            measurement={measurement}
            unit={measurement === "co2" ? "" : measurement === "temp" ? "°" : "%"}
          />
        )}
      </div>
    </div>
  );
}
