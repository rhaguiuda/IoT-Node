"use client";

import { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import Header from "@/components/Header";
import KpiGrid from "@/components/KpiGrid";
import SettingsPanel from "@/components/Settings";
import { useMqtt } from "@/lib/mqtt";
import { getRangeConfig, DEFAULT_RANGE } from "@/config/ranges";
import {
  CHART_TOOLTIP_STYLE, CHART_GRID_PROPS, CHART_AXIS_TICK,
  createTickFormatter, formatFullTime,
} from "@/components/charts/ChartTooltip";
import type { RangeId, SensorData, Reading } from "@/lib/types";

// Simple chart component for a single metric
interface SimpleChartProps {
  data: Reading[];
  title: string;
  unit: string;
  color: string;
  rangeSeconds: number;
  height?: number;
  decimals?: number;
  thresholdValue?: number;
}

const SimpleChart = memo(function SimpleChart({
  data, title, unit, color, rangeSeconds, height = 280, decimals = 0, thresholdValue,
}: SimpleChartProps) {
  const tickFormatter = createTickFormatter(rangeSeconds);
  const gradientId = `grad-${title.replace(/\s/g, "")}`;
  const formatValue = (v: number) => decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString();
  const now = Math.floor(Date.now() / 1000);
  const rangeStart = now - rangeSeconds;

  // Generate evenly spaced ticks across the full range
  const tickCount = Math.min(20, Math.max(6, Math.floor(rangeSeconds / 1800)));
  const ticks: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    ticks.push(Math.round(rangeStart + (rangeSeconds * i) / tickCount));
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</span>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{unit}</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...CHART_GRID_PROPS} />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={[rangeStart, now]}
            ticks={ticks}
            tickFormatter={tickFormatter}
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={CHART_AXIS_TICK}
            tickFormatter={(v: number) => formatValue(v)}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          {thresholdValue && (
            <line x1="0" y1={thresholdValue} x2="100%" y2={thresholdValue} />
          )}
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            labelFormatter={(ts: number) => formatFullTime(ts)}
            formatter={(v: number) => [formatValue(v), title]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

export default function Home() {
  const [range, setRange] = useState<RangeId>(DEFAULT_RANGE);
  const [historical, setHistorical] = useState<SensorData | null>(null);
  const [loading, setLoading] = useState(true);
  const { values, connected, lastMessage } = useMqtt();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/telemetry?range=${range}`);
      if (res.ok) setHistorical(await res.json());
    } catch (e) {
      console.error("Failed to fetch telemetry:", e);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rangeConfig = getRangeConfig(range);
  useEffect(() => {
    if (!rangeConfig.realtime) return;
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [rangeConfig.realtime, fetchData]);

  const co2Data = useMemo(() => historical?.co2 ?? [], [historical]);
  const tempData = useMemo(() => historical?.temp ?? [], [historical]);
  const umiData = useMemo(() => historical?.umi ?? [], [historical]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <Header connected={connected} lastMessage={lastMessage} range={range} onRangeChange={setRange} />
      <KpiGrid values={values} />
      <div className="space-y-4">
        {loading && !historical ? (
          <div className="card p-8 text-center">
            <p style={{ color: "var(--text-tertiary)" }}>Carregando dados...</p>
          </div>
        ) : (
          <>
            <SimpleChart data={co2Data} title="CO₂" unit="ppm" color="var(--accent)" rangeSeconds={rangeConfig.seconds} />
            <SimpleChart data={tempData} title="Temperatura" unit="°C" color="var(--warning)" rangeSeconds={rangeConfig.seconds} decimals={1} />
            <SimpleChart data={umiData} title="Umidade" unit="%" color="var(--info)" rangeSeconds={rangeConfig.seconds} decimals={1} />
          </>
        )}
      </div>
      <SettingsPanel />
    </main>
  );
}
