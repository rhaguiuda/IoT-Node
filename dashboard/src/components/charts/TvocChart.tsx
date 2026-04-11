"use client";

import {
  ComposedChart,
  Area,
  Line,
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

interface TvocDataPoint {
  timestamp: number;
  tvoc: number | null;
  airq: number | null;
}

interface TvocChartProps {
  data: TvocDataPoint[];
}

interface TooltipPayloadItem {
  name: string;
  value: number | null;
  color: string;
  unit?: string;
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
            <span style={{ color: "var(--text-secondary)" }}>{entry.name}: </span>
            {entry.value}
            {entry.unit}
          </p>
        ) : null
      )}
    </div>
  );
}

export default function TvocChart({ data }: TvocChartProps) {
  return (
    <AnimateIn>
      <div className="card p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            TVOC &amp; Qualidade do Ar
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-0.5 rounded"
                style={{ background: "var(--warning)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                TVOC (ppb)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-0.5 rounded"
                style={{ background: "var(--danger)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                AQI
              </span>
            </div>
          </div>
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="tvocGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--warning)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--warning)" stopOpacity={0.02} />
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
              yAxisId="tvoc"
              unit=" ppb"
              tick={CHART_AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={60}
            />

            <YAxis
              yAxisId="aqi"
              orientation="right"
              domain={[0, 5]}
              tickCount={6}
              tick={CHART_AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={32}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              yAxisId="tvoc"
              type="monotone"
              dataKey="tvoc"
              name="TVOC"
              unit=" ppb"
              stroke="var(--warning)"
              strokeWidth={2}
              fill="url(#tvocGradient)"
              dot={false}
              connectNulls
            />

            <Line
              yAxisId="aqi"
              type="step"
              dataKey="airq"
              name="AQI"
              stroke="var(--danger)"
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </AnimateIn>
  );
}
