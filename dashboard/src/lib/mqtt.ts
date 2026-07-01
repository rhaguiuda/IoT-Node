"use client";

import { useEffect, useRef, useState } from "react";
import mqtt, { MqttClient } from "mqtt";
import { MQTT_BROKER_WS } from "@/config/sensors";
import type { RealtimeValues } from "./types";

const INITIAL_VALUES: RealtimeValues = { co2: null, temp: null, umi: null };

interface DeviceState {
  values: RealtimeValues;
  lastMessage: number;
}

// Single persistent connection subscribed to every device's telemetry, so
// switching the selected device never waits on a reconnect + a fresh message
// to know whether that sensor is actually online — the data was already
// streaming in the background the whole time. Mirrors the menubar app,
// which uses the same always-on wildcard subscription.
export function useMqtt(deviceId: string | null) {
  const [connected, setConnected] = useState(false);
  const [byDevice, setByDevice] = useState<Record<string, DeviceState>>({});
  const clientRef = useRef<MqttClient | null>(null);

  useEffect(() => {
    const client = mqtt.connect(MQTT_BROKER_WS, { reconnectPeriod: 5000, connectTimeout: 10000 });
    clientRef.current = client;
    client.on("connect", () => { setConnected(true); client.subscribe("teras/iotnode/+/telemetry/#"); });
    client.on("close", () => setConnected(false));
    client.on("offline", () => setConnected(false));
    client.on("message", (t, payload) => {
      const parts = t.split("/"); // teras/iotnode/<deviceId>/telemetry/<measurement>
      const msgDeviceId = parts[2];
      const measurement = parts[4];
      const value = parseFloat(payload.toString());
      if (isNaN(value) || !msgDeviceId || !measurement) return;
      if (measurement !== "co2" && measurement !== "temp" && measurement !== "umi") return;
      setByDevice((prev) => {
        const prevDevice = prev[msgDeviceId] ?? { values: INITIAL_VALUES, lastMessage: 0 };
        return {
          ...prev,
          [msgDeviceId]: {
            values: { ...prevDevice.values, [measurement]: value },
            lastMessage: Date.now(),
          },
        };
      });
    });
    return () => { client.end(); };
  }, []);

  const current = (deviceId ? byDevice[deviceId] : undefined) ?? { values: INITIAL_VALUES, lastMessage: 0 };
  return { values: current.values, connected, lastMessage: current.lastMessage };
}
