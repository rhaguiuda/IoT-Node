"use client";

import { useEffect, useRef, useState } from "react";
import mqtt, { MqttClient } from "mqtt";
import { MQTT_BROKER_WS, topicPrefixForDevice } from "@/config/sensors";
import type { RealtimeValues } from "./types";

const INITIAL_VALUES: RealtimeValues = { co2: null, temp: null, umi: null };

// Subscribes to the selected device's telemetry only. Re-subscribes whenever
// the selected device changes; values reset so stale readings from the
// previously selected device never bleed into the new one.
export function useMqtt(deviceId: string | null) {
  const [values, setValues] = useState<RealtimeValues>(INITIAL_VALUES);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<number>(0);
  const clientRef = useRef<MqttClient | null>(null);

  useEffect(() => {
    if (!deviceId) return;
    // Reset realtime state on device switch
    setValues(INITIAL_VALUES);
    setLastMessage(0);

    const topic = `${topicPrefixForDevice(deviceId)}/#`;
    const client = mqtt.connect(MQTT_BROKER_WS, { reconnectPeriod: 5000, connectTimeout: 10000 });
    clientRef.current = client;
    client.on("connect", () => { setConnected(true); client.subscribe(topic); });
    client.on("close", () => setConnected(false));
    client.on("offline", () => setConnected(false));
    client.on("message", (t, payload) => {
      const measurement = t.split("/").pop();
      const value = parseFloat(payload.toString());
      if (isNaN(value) || !measurement) return;
      if (measurement !== "co2" && measurement !== "temp" && measurement !== "umi") return;
      setLastMessage(Date.now());
      setValues((prev) => ({ ...prev, [measurement]: value }));
    });
    return () => { client.end(); };
  }, [deviceId]);

  return { values, connected, lastMessage };
}
