"use client";

import type { Device } from "@/lib/types";
import { deviceLabel } from "@/lib/types";
import MaterialIcon from "@/components/MaterialIcon";

interface DeviceSelectorProps {
  devices: Device[];
  value: string | null;
  onChange: (deviceId: string) => void;
}

export default function DeviceSelector({ devices, value, onChange }: DeviceSelectorProps) {
  // Only a switcher: the selected device's name is shown in the header title.
  // With 0 or 1 device there is nothing to switch between.
  if (devices.length <= 1) return null;

  return (
    <div
      className="relative inline-flex items-center rounded-lg"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
    >
      <span className="pl-2.5 pr-1 flex items-center">
        <MaterialIcon name="sensors" size={16} color="var(--text-tertiary)" />
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-transparent pr-7 py-1.5 text-sm font-semibold cursor-pointer focus:outline-none"
        style={{ color: "var(--text-primary)" }}
      >
        {devices.map((d) => (
          <option key={d.device_id} value={d.device_id} style={{ color: "#000" }}>
            {deviceLabel(d)}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-1.5 flex items-center">
        <MaterialIcon name="expand_more" size={16} color="var(--text-secondary)" />
      </span>
    </div>
  );
}
