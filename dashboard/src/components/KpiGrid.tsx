"use client";

import StaggerChildren, { StaggerItem } from "@/components/animation/StaggerChildren";
import KpiCard from "@/components/KpiCard";
import { SENSOR_METRICS, KPI_METRICS } from "@/config/sensors";
import type { RealtimeValues } from "@/lib/types";

const ICON_COLORS: Record<string, string> = {
  co2: "#2eccc0",
  temp: "#f97316",
  umi: "#3b82f6",
};

interface KpiGridProps {
  values: RealtimeValues;
}

export default function KpiGrid({ values }: KpiGridProps) {
  return (
    <StaggerChildren stagger={0.04} className="grid grid-cols-3 gap-3">
      {KPI_METRICS.map((measurement) => {
        const metric = SENSOR_METRICS.find((m) => m.measurement === measurement);
        if (!metric) return null;
        const value = values[measurement as keyof RealtimeValues];
        const iconColor = ICON_COLORS[measurement] ?? "#2eccc0";

        return (
          <StaggerItem key={measurement}>
            <KpiCard
              iconName={metric.icon}
              value={value}
              label={metric.label}
              unit={metric.unit}
              measurement={measurement}
              iconColor={iconColor}
            />
          </StaggerItem>
        );
      })}
    </StaggerChildren>
  );
}
