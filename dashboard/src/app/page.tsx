"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, memo, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import Header from "@/components/Header";
import KpiGrid from "@/components/KpiGrid";
import SettingsPanel from "@/components/Settings";
import { useMqtt } from "@/lib/mqtt";
import type { TrendResult, Device } from "@/lib/types";
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
  decimals?: number;
  thresholdValue?: number;
  // True once measured available space comfortably fits all 3 charts without
  // scrolling (see the measurement in Home()) — false falls back to the
  // normal fixed-height stacked layout.
  fitMode?: boolean;
}

// Minimum span (seconds) that zoom can reach — prevents collapsing the domain
const MIN_ZOOM_SPAN_SECONDS = 5;
const ZOOM_IN_FACTOR = 0.8;
const ZOOM_OUT_FACTOR = 1.25;

const SimpleChart = memo(function SimpleChart({
  data, title, unit, color, rangeSeconds, decimals = 0, thresholdValue, fitMode = false,
}: SimpleChartProps) {
  const tickFormatter = createTickFormatter(rangeSeconds);
  const gradientId = `grad-${title.replace(/\s/g, "")}`;
  const formatValue = (v: number) => decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString();
  const now = Math.floor(Date.now() / 1000);
  const rangeStart = now - rangeSeconds;

  // Zoom state — domain in absolute timestamps, or null when fully zoomed out
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  // Y-axis scale mode: "abs" starts at 0, "rel" fits to visible data.
  // Persisted per chart in localStorage, keyed by chart title.
  const [scaleMode, setScaleMode] = useState<"abs" | "rel">("abs");
  const scaleStorageKey = `chart-scale:${title}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(scaleStorageKey);
      if (saved === "abs" || saved === "rel") setScaleMode(saved);
    } catch {}
  }, [scaleStorageKey]);
  useEffect(() => {
    try {
      localStorage.setItem(scaleStorageKey, scaleMode);
    } catch {}
  }, [scaleStorageKey, scaleMode]);
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
    <div className={`card p-4 ${fitMode ? "flex flex-1 min-h-[180px] flex-col" : ""}`}>
      <div className={`flex items-start justify-between mb-4 gap-3 ${fitMode ? "shrink-0" : ""}`}>
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
          <div
            className="flex rounded-md overflow-hidden"
            style={{ border: "1px solid var(--border)" }}
            title="Escala do eixo Y: absoluta (inicia em 0) ou relativa (ajusta aos dados)"
          >
            {(["abs", "rel"] as const).map((mode, i) => {
              const active = scaleMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setScaleMode(mode)}
                  className="text-[11px] font-medium px-2 py-1 transition-colors cursor-pointer"
                  style={{
                    color: active ? "var(--accent-strong)" : "var(--text-secondary)",
                    background: active ? "var(--pill-active-bg)" : "var(--bg-elevated)",
                    borderLeft: i === 0 ? "none" : "1px solid var(--border)",
                  }}
                >
                  {mode === "abs" ? "Abs" : "Rel"}
                </button>
              );
            })}
          </div>
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{unit}</span>
        </div>
      </div>
      <div
        ref={chartWrapperRef}
        style={{ touchAction: "pan-y" }}
        className={fitMode ? "h-auto flex-1 min-h-0" : "h-[280px]"}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={displayData}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            syncId="metric-charts"
            syncMethod="value"
          >
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
              domain={scaleMode === "rel" ? ["auto", "auto"] : [0, "auto"]}
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
              isAnimationActive
              animationDuration={350}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

const SELECTED_DEVICE_KEY = "selected-device";

export default function Home() {
  const [range, setRange] = useState<RangeId>(DEFAULT_RANGE);
  const [historical, setHistorical] = useState<SensorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const { values, connected, lastMessage } = useMqtt(selectedDevice);
  const [trends, setTrends] = useState<Record<string, TrendResult>>({});

  // Whether the 3 charts comfortably fit below the header/KPIs without
  // scrolling. Measured from the real, rendered layout instead of a guessed
  // viewport-height breakpoint — a fixed breakpoint can't account for browser
  // chrome (bookmarks bar, zoom, devtools), so it kept firing on windows that
  // were technically tall enough on paper but not in practice.
  const chartsRef = useRef<HTMLDivElement>(null);
  const [fitMode, setFitMode] = useState(false);
  useLayoutEffect(() => {
    const MIN_CHART_HEIGHT = 200; // px — below this a fixed 280px stack reads better than a cramped fit
    const CHART_GAP = 12; // matches gap-3 between the 3 charts
    const BOTTOM_PADDING = 24; // matches main's py-6 bottom half
    const MIN_FIT_WIDTH = 768; // md breakpoint — fit mode is a desktop affordance only
    function recompute() {
      const el = chartsRef.current;
      if (!el) return;
      // Fit-to-viewport is for wide screens. On phones the browser chrome
      // (URL bar showing/hiding on scroll) constantly changes innerHeight,
      // which made fit mode flip on/off mid-scroll and the charts jump. Below
      // the md breakpoint always use the plain scrollable stack.
      if (window.innerWidth < MIN_FIT_WIDTH) {
        setFitMode(false);
        return;
      }
      const top = el.getBoundingClientRect().top;
      const available = window.innerHeight - top - BOTTOM_PADDING;
      const perChart = (available - CHART_GAP * 2) / 3;
      setFitMode(perChart >= MIN_CHART_HEIGHT);
    }
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [devices.length]); // header height can change with device count (selector appears at 2+)

  // Fetch the device list on mount and every 30s (picks up newly seen nodes).
  // The selected device comes from localStorage when still present, else the
  // first device. A stale stored id (device gone) falls back to the first.
  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/devices");
      if (!res.ok) return;
      const list: Device[] = await res.json();
      setDevices(list);
      setSelectedDevice((prev) => {
        if (prev && list.some((d) => d.device_id === prev)) return prev;
        const stored = (() => { try { return localStorage.getItem(SELECTED_DEVICE_KEY); } catch { return null; } })();
        if (stored && list.some((d) => d.device_id === stored)) return stored;
        return list[0]?.device_id ?? null;
      });
    } catch {}
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 30000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  const handleDeviceChange = useCallback((deviceId: string) => {
    setSelectedDevice(deviceId);
    try { localStorage.setItem(SELECTED_DEVICE_KEY, deviceId); } catch {}
  }, []);

  // Rename a device from the header pencil. Empty name resets it to the MAC
  // (back to "unnamed"). Optimistic update, then refetch to confirm.
  const handleRename = useCallback(async (deviceId: string, name: string) => {
    setDevices((prev) => prev.map((d) => (d.device_id === deviceId ? { ...d, name: name || deviceId } : d)));
    try {
      await fetch("/api/devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId, name }),
      });
    } catch {}
    fetchDevices();
  }, [fetchDevices]);

  // Fetch trends from API
  const fetchTrends = useCallback(async () => {
    if (!selectedDevice) return;
    try {
      const res = await fetch(`/api/trend?device=${encodeURIComponent(selectedDevice)}`);
      if (res.ok) setTrends(await res.json());
    } catch {}
  }, [selectedDevice]);

  // Fetch trends on mount and every 10s
  useEffect(() => {
    fetchTrends();
    const interval = setInterval(fetchTrends, 10000);
    return () => clearInterval(interval);
  }, [fetchTrends]);

  const fetchData = useCallback(async () => {
    if (!selectedDevice) return;
    try {
      const res = await fetch(`/api/telemetry?range=${range}&device=${encodeURIComponent(selectedDevice)}`);
      if (res.ok) setHistorical(await res.json());
    } catch (e) {
      console.error("Failed to fetch telemetry:", e);
    } finally {
      setLoading(false);
    }
  }, [range, selectedDevice]);

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
      {/* Header + KPIs + charts fit the viewport when there's measured room
          (see fitMode above) so all 3 can be compared without scrolling.
          Otherwise this is a plain stack, unchanged. */}
      <div className={`space-y-6 ${fitMode ? "flex flex-col gap-4 h-[calc(100dvh-3rem)]" : ""}`}>
        <Header
          connected={connected}
          lastMessage={lastMessage}
          range={range}
          onRangeChange={setRange}
          devices={devices}
          selectedDevice={selectedDevice}
          onDeviceChange={handleDeviceChange}
          onRename={handleRename}
        />
        <KpiGrid values={values} trends={trends} />
        <div
          ref={chartsRef}
          className={`space-y-4 ${fitMode ? "flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto overflow-x-hidden" : ""}`}
        >
          {loading && !historical ? (
            <div className="card p-8 text-center">
              <p style={{ color: "var(--text-tertiary)" }}>Carregando dados...</p>
            </div>
          ) : (
            <>
              <SimpleChart data={co2Data} title="CO₂" unit="ppm" color="var(--accent)" rangeSeconds={rangeConfig.seconds} fitMode={fitMode} />
              <SimpleChart data={tempData} title="Temperatura" unit="°C" color="var(--warning)" rangeSeconds={rangeConfig.seconds} decimals={1} fitMode={fitMode} />
              <SimpleChart data={umiData} title="Umidade" unit="%" color="var(--info)" rangeSeconds={rangeConfig.seconds} decimals={1} fitMode={fitMode} />
            </>
          )}
        </div>
      </div>
      <SettingsPanel />
    </main>
  );
}
