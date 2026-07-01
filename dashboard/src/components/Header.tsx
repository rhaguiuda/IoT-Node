"use client";

import { useState, useEffect, useRef } from "react";
import type { RangeId, Device } from "@/lib/types";
import { deviceLabel, deviceUnnamed } from "@/lib/types";
import RangeSelector from "@/components/RangeSelector";
import ThemePicker from "@/components/ThemePicker";
import StatusBadge from "@/components/StatusBadge";
import DeviceSelector from "@/components/DeviceSelector";
import MaterialIcon from "@/components/MaterialIcon";

const SENSOR_TIMEOUT_MS = 30000;

interface HeaderProps {
  connected: boolean;
  lastMessage: number;
  range: RangeId;
  onRangeChange: (id: RangeId) => void;
  devices: Device[];
  selectedDevice: string | null;
  onDeviceChange: (deviceId: string) => void;
  onRename: (deviceId: string, name: string) => void;
}

export default function Header({
  connected,
  lastMessage,
  range,
  onRangeChange,
  devices,
  selectedDevice,
  onDeviceChange,
  onRename,
}: HeaderProps) {
  const [sensorAlive, setSensorAlive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const check = () => {
      setSensorAlive(lastMessage > 0 && Date.now() - lastMessage < SENSOR_TIMEOUT_MS);
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [lastMessage]);

  const selected = devices.find((d) => d.device_id === selectedDevice) ?? null;
  const title = selected ? deviceLabel(selected) : "Air Quality Node";

  // Trocar de device cancela uma edicao em andamento.
  useEffect(() => {
    setEditing(false);
  }, [selectedDevice]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEdit() {
    if (!selected) return;
    // Campo vazio quando ainda nao tem nome custom (mostra so o MAC).
    setDraft(deviceUnnamed(selected) ? "" : selected.name);
    setEditing(true);
  }

  function commit() {
    if (!selected) return;
    onRename(selected.device_id, draft.trim()); // vazio -> reseta pro MAC (sem nome)
    setEditing(false);
  }

  return (
    <header className="space-y-3 px-4 py-3">
      {/* Top row: title + badges + theme picker */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {editing && selected ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditing(false);
              }}
              placeholder={selected.device_id}
              className="text-xl font-bold font-display bg-transparent border-b-2 px-0.5 focus:outline-none"
              style={{ borderColor: "var(--accent)", color: "var(--text-primary)" }}
              maxLength={40}
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <h2 className="text-xl font-bold font-display">{title}</h2>
              {selected && (
                <button
                  type="button"
                  onClick={startEdit}
                  title="Renomear dispositivo"
                  aria-label="Renomear dispositivo"
                  className="inline-flex items-center rounded p-1 hover:opacity-80 transition-opacity"
                >
                  <MaterialIcon name="edit" size={16} color="var(--text-tertiary)" />
                </button>
              )}
            </div>
          )}
          <DeviceSelector devices={devices} value={selectedDevice} onChange={onDeviceChange} />
          <StatusBadge
            level={sensorAlive ? "success" : "danger"}
            label={sensorAlive ? "Sensor Online" : "Sensor Offline"}
          />
          <StatusBadge
            level={connected ? "success" : "danger"}
            label={connected ? "Broker" : "Broker Offline"}
          />
        </div>
        <ThemePicker />
      </div>
      {/* Bottom row: range selector full width */}
      <RangeSelector value={range} onChange={onRangeChange} />
    </header>
  );
}
