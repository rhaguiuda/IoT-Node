"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import AnimateIn from "@/components/animation/AnimateIn";
import {
  CHART_TOOLTIP_STYLE,
  CHART_GRID_PROPS,
  CHART_AXIS_TICK,
  formatTickTime,
  formatFullTime,
} from "./ChartTooltip";

interface Co2DataPoint {
  timestamp: number;
  scd41: number | null;
  ens160: number | null;
}

interface Co2ChartProps {
  data: Co2DataPoint[];
  threshold?: number;
}

interface TooltipPayloadItem {
  name: string;
  value: number | null;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: number;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div style={CHART_TOOLTIP_STYLE}>
      <p style={{ color: "var(--text-tertiary)", marginBottom: 4, fontWeight: 500 }}>
        {label !== undefined ? formatFullTime(label) : ""}
      </p>
      {payload.map((entry) => (
        entry.value !== null && (
          <p key={entry.name} style={{ color: entry.color, margin: "2px 0" }}>
            <span style={{ color: "var(--text-secondary)" }}>{entry.name}: </span>
            {entry.value} ppm
          </p>
        )
      ))}
    </div>
  );
}

export default function Co2Chart({ data, threshold = 1000 }: Co2ChartProps) {
  return (
    <AnimateIn>
      <div className="card p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            CO₂
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-0.5 rounded"
                style={{ background: "var(--accent)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                SCD41
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-3"
                style={{
                  height: 1,
                  background: "var(--warning)",
                  borderTop: "2px dashed var(--warning)",
                }}
              />
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                ENS160 eCO₂
              </span>
            </div>
          </div>
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="co2GradientScd41" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid {...CHART_GRID_PROPS} />

            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTickTime}
              tick={CHART_AXIS_TICK}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />

            <YAxis
              unit=" ppm"
              tick={CHART_AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={60}
            />

            <Tooltip content={<CustomTooltip />} />

            <ReferenceLine
              y={threshold}
              stroke="var(--danger)"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              label={{
                value: "Limite",
                fill: "var(--danger)",
                fontSize: 10,
                position: "insideTopRight",
              }}
            />

            <Area
              type="monotone"
              dataKey="scd41"
              name="SCD41 CO₂"
              stroke="var(--accent)"
              strokeWidth={2}
              fill="url(#co2GradientScd41)"
              dot={false}
              connectNulls
            />

            <Line
              type="monotone"
              dataKey="ens160"
              name="ENS160 eCO₂"
              stroke="var(--warning)"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </AnimateIn>
  );
}
