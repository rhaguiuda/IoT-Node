"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import MaterialIcon from "@/components/MaterialIcon";

const SCALE = [
  { range: "< 600", label: "Excelente", color: "#22c55e" },
  { range: "600–800", label: "Bom", color: "#4ade80" },
  { range: "800–1000", label: "Aceitável", color: "#86efac" },
  { range: "1000–1200", label: "Alerta", color: "#f97316" },
  { range: "1200–1500", label: "Ruim", color: "#ef4444" },
  { range: "1500–2000", label: "Muito Ruim", color: "#dc2626" },
  { range: "2000–5000", label: "Péssimo", color: "#991b1b" },
  { range: "> 5000", label: "Perigo", color: "#7f1d1d" },
];

export default function Co2ScaleInfo() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: Math.max(8, rect.left - 180) });
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <>
      <span
        ref={btnRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        className="inline-flex items-center justify-center cursor-pointer"
        style={{ opacity: 0.4 }}
      >
        <MaterialIcon name="info" size={16} color="var(--text-tertiary)" />
      </span>

      {open && createPortal(
        <div
          onMouseEnter={show}
          onMouseLeave={hide}
          className="fixed z-50 rounded-xl shadow-lg"
          style={{
            top: pos.top,
            left: pos.left,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            padding: "14px 16px",
            minWidth: 220,
          }}
        >
          <div
            className="text-[11px] font-semibold uppercase tracking-wider mb-3"
            style={{ color: "var(--text-secondary)" }}
          >
            Escala CO₂ (ppm)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {SCALE.map((s) => (
              <div key={s.range} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    backgroundColor: s.color,
                    flexShrink: 0,
                  }}
                />
                <span className="text-xs" style={{ color: "var(--text-tertiary)", width: 70 }}>
                  {s.range}
                </span>
                <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
