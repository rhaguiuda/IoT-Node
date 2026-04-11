"use client";

import { useState, useEffect } from "react";
import type { RangeId } from "@/lib/types";
import RangeSelector from "@/components/RangeSelector";
import ThemePicker from "@/components/ThemePicker";
import StatusBadge from "@/components/StatusBadge";

const SENSOR_TIMEOUT_MS = 30000;

interface HeaderProps {
  connected: boolean;
  lastMessage: number;
  range: RangeId;
  onRangeChange: (id: RangeId) => void;
}

export default function Header({ connected, lastMessage, range, onRangeChange }: HeaderProps) {
  const [sensorAlive, setSensorAlive] = useState(false);

  useEffect(() => {
    const check = () => {
      setSensorAlive(lastMessage > 0 && Date.now() - lastMessage < SENSOR_TIMEOUT_MS);
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [lastMessage]);

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold font-display">Air Quality Node</h2>
        <StatusBadge
          level={sensorAlive ? "success" : "danger"}
          label={sensorAlive ? "Sensor Online" : "Sensor Offline"}
        />
        <StatusBadge
          level={connected ? "success" : "danger"}
          label={connected ? "Broker" : "Broker Offline"}
        />
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <RangeSelector value={range} onChange={onRangeChange} />
        <ThemePicker />
      </div>
    </header>
  );
}
