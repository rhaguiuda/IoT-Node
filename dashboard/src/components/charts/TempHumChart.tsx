"use client";

import {
  ComposedChart,
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

interface TempHumDataPoint {
  timestamp: number;
  sht4xTemp: number | null;
  scd41Temp: number | null;
  sht4xUmi: number | null;
  scd41Umi: number | null;
}

interface TempHumChartProps {
  data: TempHumDataPoint[];
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

export default function TempHumChart({ data }: TempHumChartProps) {
  return (
    <AnimateIn>
      <div className="card p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Temperatura &amp; Umidade
          </span>
          <div className="flex items-center gap-4 flex-wrap justify-end">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-0.5 rounded"
                style={{ background: "var(--success)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                SHT4x °C
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-3"
                style={{ height: 1, borderTop: "2px dashed var(--info)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                SCD41 °C
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-0.5 rounded"
                style={{ background: "#a78bfa" }}
              />
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                SHT4x %
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-3"
                style={{ height: 1, borderTop: "2px dashed #f472b6" }}
              />
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                SCD41 %
              </span>
            </div>
          </div>
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
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
              yAxisId="temp"
              unit="°C"
              tick={CHART_AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={48}
            />

            <YAxis
              yAxisId="hum"
              orientation="right"
              unit="%"
              tick={CHART_AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={40}
            />

            <Tooltip content={<CustomTooltip />} />

            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="sht4xTemp"
              name="SHT4x Temp"
              unit="°C"
              stroke="var(--success)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />

            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="scd41Temp"
              name="SCD41 Temp"
              unit="°C"
              stroke="var(--info)"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              connectNulls
            />

            <Line
              yAxisId="hum"
              type="monotone"
              dataKey="sht4xUmi"
              name="SHT4x Umidade"
              unit="%"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={false}
              connectNulls
            />

            <Line
              yAxisId="hum"
              type="monotone"
              dataKey="scd41Umi"
              name="SCD41 Umidade"
              unit="%"
              stroke="#f472b6"
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
