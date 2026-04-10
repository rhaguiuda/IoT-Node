"use client";

import { Wind, Thermometer, Droplets, Factory, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import StaggerChildren, { StaggerItem } from "@/components/animation/StaggerChildren";
import KpiCard from "@/components/KpiCard";
import { KPI_METRICS, SENSOR_METRICS } from "@/config/sensors";
import type { RealtimeValues } from "@/lib/types";

const ICONS: Record<string, LucideIcon> = { Wind, Thermometer, Droplets, Factory, Sun };

const ICON_COLORS: Record<string, string> = {
  co2: "#2eccc0",
  temp: "#f97316",
  umi: "#3b82f6",
  tvoc: "#a855f7",
  airq: "#22c55e",
  lux: "#eab308",
  eco2: "#8b5cf6",
};

interface KpiGridProps {
  values: RealtimeValues;
}

export default function KpiGrid({ values }: KpiGridProps) {
  return (
    <StaggerChildren stagger={0.04} className="grid grid-cols-3 gap-3">
      {KPI_METRICS.map(({ sensor, measurement }) => {
        const metric = SENSOR_METRICS.find(
          (m) => m.sensor === sensor && m.measurement === measurement
        );
        if (!metric) return null;

        const sensorValues = values[sensor as keyof RealtimeValues] as Record<string, number | null>;
        const value = sensorValues?.[measurement] ?? null;

        const Icon = ICONS[metric.icon] ?? Wind;
        const iconColor = ICON_COLORS[measurement] ?? "#2eccc0";

        return (
          <StaggerItem key={`${sensor}-${measurement}`}>
            <KpiCard
              icon={Icon}
              value={value}
              label={metric.label}
              unit={metric.unit}
              sensor={sensor}
              measurement={measurement}
              iconColor={iconColor}
            />
          </StaggerItem>
        );
      })}
    </StaggerChildren>
  );
}
