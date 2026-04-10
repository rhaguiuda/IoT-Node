"use client";

import type { LucideIcon } from "lucide-react";
import CountUp from "@/components/animation/CountUp";
import StatusBadge from "@/components/StatusBadge";
import { getThreshold, thresholdColor } from "@/lib/thresholds";

interface KpiCardProps {
  icon: LucideIcon;
  value: number | null;
  label: string;
  unit: string;
  sensor: string;
  measurement: string;
  iconColor: string;
}

export default function KpiCard({
  icon: Icon,
  value,
  label,
  unit,
  sensor,
  measurement,
  iconColor,
}: KpiCardProps) {
  const threshold = value !== null ? getThreshold(sensor, measurement, value) : null;
  const valueColor = threshold ? thresholdColor(threshold.level) : "var(--text-tertiary)";

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3.5">
        {/* Icon */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: `linear-gradient(135deg, ${iconColor}22, ${iconColor}0a)`,
          }}
        >
          <Icon className="w-[22px] h-[22px]" style={{ color: iconColor }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Value */}
          <div
            className="text-[22px] font-bold tracking-tight leading-none tabular-nums"
            style={{
              color: valueColor,
              fontFamily: "var(--font-display)",
            }}
          >
            {value !== null ? (
              <>
                <CountUp
                  value={value}
                  decimals={value % 1 !== 0 ? 1 : 0}
                  duration={0.5}
                />
                {unit && (
                  <span className="text-[14px] font-medium ml-0.5">{unit}</span>
                )}
              </>
            ) : (
              <span style={{ color: "var(--text-tertiary)" }}>--</span>
            )}
          </div>

          {/* Label */}
          <div className="mt-1">
            <span
              className="text-[11px] font-medium uppercase tracking-wider leading-tight block"
              style={{ color: "var(--text-tertiary)" }}
            >
              {label}
            </span>
          </div>

          {/* Status Badge */}
          {threshold && threshold.label && (
            <div className="mt-1">
              <StatusBadge level={threshold.level} label={threshold.label} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
