export const MQTT_BROKER_WS = "ws://192.168.100.224:8884/mqtt";
export const MQTT_TOPIC_PREFIX = "teras/iotnode/1/telemetry";

export interface SensorMetric {
  measurement: string;
  topic: string;
  label: string;
  unit: string;
  icon: string;
}

export const SENSOR_METRICS: SensorMetric[] = [
  { measurement: "co2", topic: `${MQTT_TOPIC_PREFIX}/co2`, label: "CO₂", unit: "ppm", icon: "co2" },
  { measurement: "temp", topic: `${MQTT_TOPIC_PREFIX}/temp`, label: "Temperatura", unit: "°C", icon: "thermostat" },
  { measurement: "umi", topic: `${MQTT_TOPIC_PREFIX}/umi`, label: "Umidade", unit: "%", icon: "humidity_percentage" },
];

export const KPI_METRICS = ["co2", "temp", "umi"];
