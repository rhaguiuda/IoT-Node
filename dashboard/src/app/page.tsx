"use client";

import { useState, useEffect, useCallback, useMemo, memo, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import Header from "@/components/Header";
import KpiGrid from "@/components/KpiGrid";
import SettingsPanel from "@/components/Settings";
import { useMqtt } from "@/lib/mqtt";
import type { TrendResult } from "@/lib/types";
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

// Minimum span (seconds) that zoom can reach — prevents collapsing the domain
const MIN_ZOOM_SPAN_SECONDS = 5;
const ZOOM_IN_FACTOR = 0.8;
const ZOOM_OUT_FACTOR = 1.25;

const SimpleChart = memo(function SimpleChart({
  data, title, unit, color, rangeSeconds, height = 280, decimals = 0, thresholdValue,
}: SimpleChartProps) {
  const tickFormatter = createTickFormatter(rangeSeconds);
  const gradientId = `grad-${title.replace(/\s/g, "")}`;
  const formatValue = (v: number) => decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString();
  const now = Math.floor(Date.now() / 1000);
  const rangeStart = now - rangeSeconds;

  // Zoom state — domain in absolute timestamps, or null when fully zoomed out
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);

  // Reset zoom whenever the selected range preset changes
  useEffect(() => { setZoomDomain(null); }, [rangeSeconds]);

  // Non-passive wheel listener so we can preventDefault (page-scroll suppression
  // only works with { passive: false }, which React's onWheel does not guarantee)
  useEffect(() => {
    const el = chartWrapperRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      const svg = el.querySelector(".recharts-surface") as SVGSVGElement | null;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      if (relX < 0 || relX > rect.width) return;
      e.preventDefault();

      const currentNow = Math.floor(Date.now() / 1000);
      const fullStart = currentNow - rangeSeconds;
      const fullEnd = currentNow;
      const [dStart, dEnd] = zoomDomain ?? [fullStart, fullEnd];
      const cursorTs = dStart + (relX / rect.width) * (dEnd - dStart);
      const factor = e.deltaY < 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR;

      let newStart = cursorTs - (cursorTs - dStart) * factor;
      let newEnd = cursorTs + (dEnd - cursorTs) * factor;
      newStart = Math.max(fullStart, newStart);
      newEnd = Math.min(fullEnd, newEnd);

      // Fully zoomed out → clear zoom
      if (newStart <= fullStart && newEnd >= fullEnd) {
        setZoomDomain(null);
        return;
      }
      // Prevent over-zoom-in that would collapse the domain
      if (newEnd - newStart < MIN_ZOOM_SPAN_SECONDS) return;
      setZoomDomain([newStart, newEnd]);
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [zoomDomain, rangeSeconds]);

  // Effective domain and data used by the chart
  const [domainStart, domainEnd] = zoomDomain ?? [rangeStart, now];
  const domainSpan = domainEnd - domainStart;
  const displayData = zoomDomain
    ? data.filter(d => d.timestamp >= domainStart && d.timestamp <= domainEnd)
    : data;

  // Min / avg / max over the visible interval
  let stats: { min: number; avg: number; max: number } | null = null;
  if (displayData.length > 0) {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const d of displayData) {
      if (d.value < min) min = d.value;
      if (d.value > max) max = d.value;
      sum += d.value;
    }
    stats = { min, max, avg: sum / displayData.length };
  }

  // Generate evenly spaced ticks across the (possibly zoomed) domain
  const tickCount = Math.min(20, Math.max(6, Math.floor(domainSpan / 1800)));
  const ticks: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    ticks.push(Math.round(domainStart + (domainSpan * i) / tickCount));
  }

  // Pick formatter granularity based on visible span when zoomed, else full range
  const effectiveTickFormatter = zoomDomain ? createTickFormatter(domainSpan) : tickFormatter;

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</span>
          {stats && (
            <span
              className="text-[11px] mt-0.5 tabular-nums"
              style={{ color: "var(--text-tertiary)" }}
            >
              Mín <span style={{ color: "var(--text-secondary)" }}>{formatValue(stats.min)}</span>
              <span className="mx-1.5 opacity-50">·</span>
              Méd <span style={{ color: "var(--text-secondary)" }}>{formatValue(stats.avg)}</span>
              <span className="mx-1.5 opacity-50">·</span>
              Máx <span style={{ color: "var(--text-secondary)" }}>{formatValue(stats.max)}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {zoomDomain && (
            <button
              type="button"
              onClick={() => setZoomDomain(null)}
              className="text-[11px] font-medium px-2 py-1 rounded-md transition-colors"
              style={{
                color: "var(--text-secondary)",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
              }}
            >
              Reset zoom
            </button>
          )}
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{unit}</span>
        </div>
      </div>
      <div ref={chartWrapperRef} style={{ touchAction: "pan-y" }}>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={displayData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
              domain={[domainStart, domainEnd]}
              ticks={ticks}
              tickFormatter={effectiveTickFormatter}
              tick={CHART_AXIS_TICK}
              axisLine={false}
              tickLine={false}
              allowDataOverflow
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
              labelFormatter={(ts) => formatFullTime(Number(ts))}
              formatter={(v) => [formatValue(Number(v)), title]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

export default function Home() {
  const [range, setRange] = useState<RangeId>(DEFAULT_RANGE);
  const [historical, setHistorical] = useState<SensorData | null>(null);
  const [loading, setLoading] = useState(true);
  const { values, connected, lastMessage } = useMqtt();
  const [trends, setTrends] = useState<Record<string, TrendResult>>({});

  // Fetch trends from API
  const fetchTrends = useCallback(async () => {
    try {
      const res = await fetch("/api/trend");
      if (res.ok) setTrends(await res.json());
    } catch {}
  }, []);

  // Fetch trends on mount and every 10s
  useEffect(() => {
    fetchTrends();
    const interval = setInterval(fetchTrends, 10000);
    return () => clearInterval(interval);
  }, [fetchTrends]);

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
      <KpiGrid values={values} trends={trends} />
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
