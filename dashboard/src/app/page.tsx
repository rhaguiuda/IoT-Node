"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Header from "@/components/Header";
import KpiGrid from "@/components/KpiGrid";
import Co2Chart from "@/components/charts/Co2Chart";
import TempHumChart from "@/components/charts/TempHumChart";
import TvocChart from "@/components/charts/TvocChart";
import LuxChart from "@/components/charts/LuxChart";
import SettingsPanel from "@/components/Settings";
import AnimateIn from "@/components/animation/AnimateIn";
import { useMqtt } from "@/lib/mqtt";
import { getRangeConfig, DEFAULT_RANGE } from "@/config/ranges";
import type { RangeId, SensorData, Reading } from "@/lib/types";

function mergeReadings(
  base: Reading[],
  sensor: string,
  measurement: string,
  realtimeMap: Map<string, { value: number; timestamp: number }>
): Reading[] {
  const key = `${sensor}/${measurement}`;
  const rt = realtimeMap.get(key);
  if (!rt) return base;
  const last = base.length > 0 ? base[base.length - 1].timestamp : 0;
  if (rt.timestamp > last) {
    return [...base, { timestamp: rt.timestamp, value: rt.value }];
  }
  return base;
}

export default function Home() {
  const [range, setRange] = useState<RangeId>(DEFAULT_RANGE);
  const [historical, setHistorical] = useState<SensorData | null>(null);
  const [loading, setLoading] = useState(true);
  const { values, connected, lastMessage } = useMqtt();
  const realtimeBuffer = useRef<Map<string, { value: number; timestamp: number }>>(new Map());

  useEffect(() => {
    if (lastMessage === 0) return;
    const ts = Math.floor(lastMessage / 1000);
    const entries: [string, number | null][] = [
      ["scd41/co2", values.scd41.co2],
      ["scd41/temp", values.scd41.temp],
      ["scd41/umi", values.scd41.umi],
      ["ens160/eco2", values.ens160.eco2],
      ["ens160/tvoc", values.ens160.tvoc],
      ["ens160/airq", values.ens160.airq],
      ["sht4x/temp", values.sht4x.temp],
      ["sht4x/umi", values.sht4x.umi],
      ["bh1750/lux", values.bh1750.lux],
    ];
    for (const [key, val] of entries) {
      if (val !== null) {
        realtimeBuffer.current.set(key, { value: val, timestamp: ts });
      }
    }
  }, [values, lastMessage]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/telemetry?range=${range}`);
      if (res.ok) {
        setHistorical(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch telemetry:", e);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rangeConfig = getRangeConfig(range);
  const buf = realtimeBuffer.current;

  const mr = (readings: Reading[], sensor: string, measurement: string) =>
    rangeConfig.realtime ? mergeReadings(readings, sensor, measurement, buf) : readings;

  const co2Data = historical
    ? (() => {
        const scd = mr(historical.scd41.co2, "scd41", "co2");
        const ens = mr(historical.ens160.eco2, "ens160", "eco2");
        const ts = new Set([...scd.map((r) => r.timestamp), ...ens.map((r) => r.timestamp)]);
        const scdM = new Map(scd.map((r) => [r.timestamp, r.value]));
        const ensM = new Map(ens.map((r) => [r.timestamp, r.value]));
        return Array.from(ts).sort((a, b) => a - b).map((t) => ({
          timestamp: t, scd41: scdM.get(t) ?? null, ens160: ensM.get(t) ?? null,
        }));
      })()
    : [];

  const tempHumData = historical
    ? (() => {
        const s1 = mr(historical.sht4x.temp, "sht4x", "temp");
        const s2 = mr(historical.scd41.temp, "scd41", "temp");
        const s3 = mr(historical.sht4x.umi, "sht4x", "umi");
        const s4 = mr(historical.scd41.umi, "scd41", "umi");
        const ts = new Set([...s1.map((r) => r.timestamp), ...s2.map((r) => r.timestamp), ...s3.map((r) => r.timestamp), ...s4.map((r) => r.timestamp)]);
        const m1 = new Map(s1.map((r) => [r.timestamp, r.value]));
        const m2 = new Map(s2.map((r) => [r.timestamp, r.value]));
        const m3 = new Map(s3.map((r) => [r.timestamp, r.value]));
        const m4 = new Map(s4.map((r) => [r.timestamp, r.value]));
        return Array.from(ts).sort((a, b) => a - b).map((t) => ({
          timestamp: t, sht4xTemp: m1.get(t) ?? null, scd41Temp: m2.get(t) ?? null,
          sht4xUmi: m3.get(t) ?? null, scd41Umi: m4.get(t) ?? null,
        }));
      })()
    : [];

  const tvocData = historical
    ? (() => {
        const tvoc = mr(historical.ens160.tvoc, "ens160", "tvoc");
        const airq = mr(historical.ens160.airq, "ens160", "airq");
        const ts = new Set([...tvoc.map((r) => r.timestamp), ...airq.map((r) => r.timestamp)]);
        const tM = new Map(tvoc.map((r) => [r.timestamp, r.value]));
        const aM = new Map(airq.map((r) => [r.timestamp, r.value]));
        return Array.from(ts).sort((a, b) => a - b).map((t) => ({
          timestamp: t, tvoc: tM.get(t) ?? null, airq: aM.get(t) ?? null,
        }));
      })()
    : [];

  const luxData = historical
    ? mr(historical.bh1750.lux, "bh1750", "lux").map((r) => ({ timestamp: r.timestamp, lux: r.value }))
    : [];

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <Header connected={connected} range={range} onRangeChange={setRange} />
      <KpiGrid values={values} />
      <AnimateIn key={range} type="fade" duration={0.3}>
        <div className="space-y-4">
          {loading && !historical ? (
            <div className="card p-8 text-center">
              <p style={{ color: "var(--text-tertiary)" }}>Carregando dados...</p>
            </div>
          ) : (
            <>
              <Co2Chart data={co2Data} threshold={1000} />
              <TempHumChart data={tempHumData} />
              <TvocChart data={tvocData} />
              <LuxChart data={luxData} />
            </>
          )}
        </div>
      </AnimateIn>
      <SettingsPanel />
    </main>
  );
}
