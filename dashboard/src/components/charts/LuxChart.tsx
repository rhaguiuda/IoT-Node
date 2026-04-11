"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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

interface LuxDataPoint {
  timestamp: number;
  lux: number | null;
}

interface LuxChartProps {
  data: LuxDataPoint[];
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
      {payload.map((entry) =>
        entry.value !== null ? (
          <p key={entry.name} style={{ color: entry.color, margin: "2px 0" }}>
            <span style={{ color: "var(--text-secondary)" }}>Luminosidade: </span>
            {entry.value} lx
          </p>
        ) : null
      )}
    </div>
  );
}

export default function LuxChart({ data }: LuxChartProps) {
  return (
    <AnimateIn>
      <div className="card p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Luminosidade
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-0.5 rounded"
              style={{ background: "var(--info)" }}
            />
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              lx
            </span>
          </div>
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="luxGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--info)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--info)" stopOpacity={0.02} />
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
              unit=" lx"
              tick={CHART_AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={56}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="lux"
              name="Lux"
              stroke="var(--info)"
              strokeWidth={2}
              fill="url(#luxGradient)"
              dot={false}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </AnimateIn>
  );
}
