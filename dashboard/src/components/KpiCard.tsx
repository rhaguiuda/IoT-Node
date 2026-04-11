"use client";

import type { LucideIcon } from "lucide-react";
import CountUp from "@/components/animation/CountUp";
import StatusBadge from "@/components/StatusBadge";
import { getThreshold } from "@/lib/thresholds";

interface KpiCardProps {
  icon: LucideIcon;
  value: number | null;
  label: string;
  unit: string;
  measurement: string;
  iconColor: string;
}

export default function KpiCard({
  icon: Icon,
  value,
  label,
  unit,
  measurement,
  iconColor,
}: KpiCardProps) {
  const threshold = value !== null ? getThreshold(measurement, value) : null;
  const needsDecimal = measurement === "temp" || measurement === "umi";
  const decimals = needsDecimal ? 1 : 0;

  return (
    <div className="card p-4 h-full">
      <div className="flex items-center gap-3.5 h-full">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, ${iconColor}22, ${iconColor}0a)` }}
        >
          <Icon className="w-[22px] h-[22px]" style={{ color: iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="text-[22px] font-bold tracking-tight leading-none tabular-nums"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
          >
            {value !== null ? (
              <>
                <CountUp value={value} decimals={decimals} duration={0.5} />
                {unit && <span className="text-[14px] font-medium ml-0.5">{unit}</span>}
              </>
            ) : (
              <span style={{ color: "var(--text-tertiary)" }}>--</span>
            )}
          </div>
          <div className="mt-1">
            <span className="text-[11px] font-medium uppercase tracking-wider leading-tight" style={{ color: "var(--text-tertiary)" }}>
              {label}
            </span>
          </div>
          <div className="mt-1 min-h-[22px]">
            {threshold && threshold.label ? (
              <StatusBadge level={threshold.level} label={threshold.label} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
