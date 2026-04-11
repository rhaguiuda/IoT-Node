"use client";

import { useEffect, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import type { Settings } from "@/lib/types";

const defaultSettings: Settings = {
  co2_threshold: 1000,
  offline_timeout: 5,
  alert_cooldown: 15,
  alerts_enabled: true,
  pushover_user_key: "",
  pushover_api_token: "",
  theme: "dark",
};

const inputClass =
  "bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm " +
  "text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] w-full";

const labelClass =
  "text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1 block";

export default function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: Settings) => setSettings((prev) => ({ ...prev, ...data })))
      .catch(() => {/* silently fall back to defaults */});
  }, []);

  function handleChange<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8">
      {/* Toggle header */}
      <div
        className="flex flex-row items-center gap-2 cursor-pointer select-none w-fit"
        onClick={() => setIsOpen((v) => !v)}
        role="button"
        aria-expanded={isOpen}
      >
        <span
          className="transition-transform duration-200 inline-flex"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <MaterialIcon name="expand_more" size={18} color="var(--text-secondary)" />
        </span>
        <span className="text-sm font-semibold text-[var(--text-secondary)]">
          Configurações
        </span>
      </div>

      {/* Collapsible content */}
      {isOpen && (
        <div className="card p-5 mt-3">
          <div className="grid grid-cols-2 gap-4">
            {/* CO₂ Threshold */}
            <div>
              <label className={labelClass}>Limite CO₂ (ppm)</label>
              <input
                type="number"
                className={inputClass}
                value={settings.co2_threshold}
                onChange={(e) =>
                  handleChange("co2_threshold", Number(e.target.value))
                }
              />
            </div>

            {/* Offline Timeout */}
            <div>
              <label className={labelClass}>Timeout offline (min)</label>
              <input
                type="number"
                className={inputClass}
                value={settings.offline_timeout}
                onChange={(e) =>
                  handleChange("offline_timeout", Number(e.target.value))
                }
              />
            </div>

            {/* Alert Cooldown */}
            <div>
              <label className={labelClass}>Cooldown alertas (min)</label>
              <input
                type="number"
                className={inputClass}
                value={settings.alert_cooldown}
                onChange={(e) =>
                  handleChange("alert_cooldown", Number(e.target.value))
                }
              />
            </div>

            {/* Alerts Enabled toggle */}
            <div>
              <label className={labelClass}>Alertas ativados</label>
              <div className="flex items-center h-[38px]">
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.alerts_enabled}
                  onClick={() =>
                    handleChange("alerts_enabled", !settings.alerts_enabled)
                  }
                  className="relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-secondary)]"
                  style={{
                    width: 40,
                    height: 22,
                    background: settings.alerts_enabled
                      ? "var(--accent)"
                      : "var(--border)",
                  }}
                >
                  <span
                    className="inline-block rounded-full bg-white shadow transition-transform duration-200"
                    style={{
                      width: 16,
                      height: 16,
                      transform: settings.alerts_enabled
                        ? "translateX(20px)"
                        : "translateX(3px)",
                    }}
                  />
                </button>
              </div>
            </div>

            {/* Pushover User Key */}
            <div>
              <label className={labelClass}>Pushover User Key</label>
              <input
                type="password"
                className={inputClass}
                value={settings.pushover_user_key}
                onChange={(e) =>
                  handleChange("pushover_user_key", e.target.value)
                }
                autoComplete="off"
              />
            </div>

            {/* Pushover API Token */}
            <div>
              <label className={labelClass}>Pushover API Token</label>
              <input
                type="password"
                className={inputClass}
                value={settings.pushover_api_token}
                onChange={(e) =>
                  handleChange("pushover_api_token", e.target.value)
                }
                autoComplete="off"
              />
            </div>

            {/* Save button */}
            <div className="col-span-2 flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-[var(--accent)] text-white rounded-lg px-6 py-2 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {saved ? "Salvo!" : saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
