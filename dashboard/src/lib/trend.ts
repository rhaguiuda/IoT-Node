"use client";

import { useRef, useCallback } from "react";

const WINDOW_SIZE = 24;        // 2 minutes at ~5s per sample
const MIN_SAMPLES = 12;        // Need at least 1 min in each window before showing trend
const BUFFER_SIZE = WINDOW_SIZE * 2; // 4 minutes total

const DEADBAND: Record<string, number> = {
  co2: 5,
  temp: 0.2,
  umi: 0.5,
};

export type TrendDirection = "up" | "down" | "stable" | null;

export interface TrendResult {
  direction: TrendDirection;
  delta: number;
}

export function useTrend() {
  const buffers = useRef<Record<string, number[]>>({
    co2: [],
    temp: [],
    umi: [],
  });

  const pushValue = useCallback((measurement: string, value: number) => {
    const buf = buffers.current[measurement];
    if (!buf) return;
    buf.push(value);
    if (buf.length > BUFFER_SIZE) {
      buf.shift();
    }
  }, []);

  const getTrend = useCallback((measurement: string): TrendResult => {
    const buf = buffers.current[measurement];
    if (!buf || buf.length < WINDOW_SIZE + MIN_SAMPLES) {
      return { direction: null, delta: 0 };
    }

    const currentWindow = buf.slice(-WINDOW_SIZE);
    const previousWindow = buf.slice(-BUFFER_SIZE, -WINDOW_SIZE);

    if (previousWindow.length < MIN_SAMPLES) {
      return { direction: null, delta: 0 };
    }

    const currentAvg = currentWindow.reduce((a, b) => a + b, 0) / currentWindow.length;
    const previousAvg = previousWindow.reduce((a, b) => a + b, 0) / previousWindow.length;
    const delta = currentAvg - previousAvg;
    const deadband = DEADBAND[measurement] ?? 1;

    if (Math.abs(delta) < deadband) {
      return { direction: "stable", delta: 0 };
    }

    return {
      direction: delta > 0 ? "up" : "down",
      delta: Math.round(delta * 10) / 10,
    };
  }, []);

  return { pushValue, getTrend };
}
