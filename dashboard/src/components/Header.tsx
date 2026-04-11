"use client";

import type { RangeId } from "@/lib/types";
import RangeSelector from "@/components/RangeSelector";
import ThemePicker from "@/components/ThemePicker";
import StatusBadge from "@/components/StatusBadge";

interface HeaderProps {
  connected: boolean;
  range: RangeId;
  onRangeChange: (id: RangeId) => void;
}

export default function Header({ connected, range, onRangeChange }: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
      {/* Left: title + status */}
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold font-display">Air Quality Node</h2>
        <StatusBadge
          level={connected ? "success" : "danger"}
          label={connected ? "Online" : "Offline"}
        />
      </div>

      {/* Right: range selector + theme picker */}
      <div className="flex items-center gap-2 min-w-0">
        <RangeSelector value={range} onChange={onRangeChange} />
        <ThemePicker />
      </div>
    </header>
  );
}
