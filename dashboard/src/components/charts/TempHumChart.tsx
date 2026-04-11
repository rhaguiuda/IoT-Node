"use client";

import { memo } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  CHART_TOOLTIP_STYLE,
  CHART_GRID_PROPS,
  CHART_AXIS_TICK,
  createTickFormatter,
  formatFullTime,
} from "./ChartTooltip";

interface TempDataPoint {
  timestamp: number;
  sht4xTemp: number | null;
  scd41Temp: number | null;
}

interface TempChartProps {
  data: TempDataPoint[];
  rangeSeconds?: number;
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
            {typeof entry.value === "number" ? entry.value.toFixed(1) : entry.value}{entry.unit}
          </p>
        ) : null
      )}
    </div>
  );
}

export default memo(function TempChart({ data, rangeSeconds = 3600 }: TempChartProps) {
  const tickFormatter = createTickFormatter(rangeSeconds);
  return (
    <>
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Temperatura
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 rounded" style={{ background: "var(--success)" }} />
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>SHT4x</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3" style={{ height: 1, borderTop: "2px dashed var(--info)" }} />
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>SCD41</span>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...CHART_GRID_PROPS} />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={["dataMin", "dataMax"]}
              scale="time"
              tickFormatter={tickFormatter}
              tick={CHART_AXIS_TICK}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis unit="°C" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} width={48} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="sht4xTemp"
              name="SHT4x"
              unit="°C"
              stroke="var(--success)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="scd41Temp"
              name="SCD41"
              unit="°C"
              stroke="var(--info)"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );
});
