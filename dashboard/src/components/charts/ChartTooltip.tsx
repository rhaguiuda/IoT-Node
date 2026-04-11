"use client";

import React from "react";

export const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--text-primary)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  padding: "8px 12px",
};

export const CHART_GRID_PROPS = {
  strokeDasharray: "3 3",
  stroke: "var(--border)",
  strokeOpacity: 0.6,
  vertical: false,
};

export const CHART_AXIS_TICK = {
  fontSize: 11,
  fill: "var(--text-tertiary)",
};

export function formatTickTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatFullTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
