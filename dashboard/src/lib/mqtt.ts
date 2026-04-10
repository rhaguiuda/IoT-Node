"use client";

import { useEffect, useRef, useState } from "react";
import mqtt, { MqttClient } from "mqtt";
import { MQTT_BROKER_WS, MQTT_TOPIC_PREFIX } from "@/config/sensors";
import type { RealtimeValues } from "./types";

const INITIAL_VALUES: RealtimeValues = {
  scd41: { co2: null, temp: null, umi: null },
  ens160: { eco2: null, tvoc: null, airq: null },
  sht4x: { temp: null, umi: null },
  bh1750: { lux: null },
};

export function useMqtt() {
  const [values, setValues] = useState<RealtimeValues>(INITIAL_VALUES);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<number>(0);
  const clientRef = useRef<MqttClient | null>(null);

  useEffect(() => {
    const client = mqtt.connect(MQTT_BROKER_WS, {
      reconnectPeriod: 5000,
      connectTimeout: 10000,
    });
    clientRef.current = client;

    client.on("connect", () => {
      setConnected(true);
      client.subscribe(`${MQTT_TOPIC_PREFIX}/#`);
    });

    client.on("close", () => setConnected(false));
    client.on("offline", () => setConnected(false));

    client.on("message", (topic, payload) => {
      // topic: teras/iotnode/1/telemetry/<sensor>/<measurement>
      const parts = topic.split("/");
      if (parts.length !== 6) return;

      const sensor = parts[4] as keyof RealtimeValues;
      const measurement = parts[5];
      const value = parseFloat(payload.toString());
      if (isNaN(value)) return;

      setLastMessage(Date.now());
      setValues((prev) => {
        const sensorData = prev[sensor];
        if (!sensorData || !(measurement in sensorData)) return prev;
        return {
          ...prev,
          [sensor]: { ...sensorData, [measurement]: value },
        };
      });
    });

    return () => { client.end(); };
  }, []);

  return { values, connected, lastMessage };
}
