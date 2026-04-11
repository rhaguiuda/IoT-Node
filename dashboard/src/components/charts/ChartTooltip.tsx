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

export function createTickFormatter(rangeSeconds: number): (timestamp: number) => string {
  return (timestamp: number) => {
    const d = new Date(timestamp * 1000);
    if (rangeSeconds <= 3600) {
      // Up to 1h: HH:mm:ss
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    }
    if (rangeSeconds <= 86400) {
      // Up to 24h: HH:mm
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    if (rangeSeconds <= 604800) {
      // Up to 7d: DD/MM HH:mm
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
      return `${day}/${month} ${time}`;
    }
    // 14d, 30d: DD/MM
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
  };
}

export function formatFullTime(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return `${day}/${month} ${time}`;
}
