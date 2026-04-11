"use client";

import { RANGES } from "@/config/ranges";
import type { RangeId } from "@/lib/types";

interface RangeSelectorProps {
  value: RangeId;
  onChange: (id: RangeId) => void;
}

export default function RangeSelector({ value, onChange }: RangeSelectorProps) {
  return (
    <div
      className="flex flex-row gap-1.5 overflow-x-auto"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
    >
      {RANGES.map((range) => {
        const active = range.id === value;
        return (
          <button
            key={range.id}
            onClick={() => onChange(range.id)}
            className="rounded-full px-3 py-1 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
            style={
              active
                ? {
                    background: "var(--pill-active-bg)",
                    color: "var(--accent-strong)",
                    border: "1px solid var(--accent-border)",
                  }
                : {
                    background: "var(--pill-bg)",
                    color: "var(--text-secondary)",
                    border: "1px solid transparent",
                  }
            }
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}
