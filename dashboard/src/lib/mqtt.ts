"use client";

import { useEffect, useRef, useState } from "react";
import mqtt, { MqttClient } from "mqtt";
import { MQTT_BROKER_WS, MQTT_TOPIC_PREFIX } from "@/config/sensors";
import type { RealtimeValues } from "./types";

const INITIAL_VALUES: RealtimeValues = { co2: null, temp: null, umi: null };

export function useMqtt() {
  const [values, setValues] = useState<RealtimeValues>(INITIAL_VALUES);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<number>(0);
  const clientRef = useRef<MqttClient | null>(null);

  useEffect(() => {
    const client = mqtt.connect(MQTT_BROKER_WS, { reconnectPeriod: 5000, connectTimeout: 10000 });
    clientRef.current = client;
    client.on("connect", () => { setConnected(true); client.subscribe(`${MQTT_TOPIC_PREFIX}/#`); });
    client.on("close", () => setConnected(false));
    client.on("offline", () => setConnected(false));
    client.on("message", (topic, payload) => {
      const measurement = topic.split("/").pop();
      const value = parseFloat(payload.toString());
      if (isNaN(value) || !measurement) return;
      if (measurement !== "co2" && measurement !== "temp" && measurement !== "umi") return;
      setLastMessage(Date.now());
      setValues((prev) => ({ ...prev, [measurement]: value }));
    });
    return () => { client.end(); };
  }, []);

  return { values, connected, lastMessage };
}
