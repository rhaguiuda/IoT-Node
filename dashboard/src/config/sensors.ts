export const MQTT_BROKER_WS = "ws://192.168.100.224:8884/mqtt";

// Telemetry topic prefix for a given device id:
//   teras/iotnode/<deviceId>/telemetry
export function topicPrefixForDevice(deviceId: string): string {
  return `teras/iotnode/${deviceId}/telemetry`;
}

export interface SensorMetric {
  measurement: string;
  label: string;
  unit: string;
  icon: string;
}

export const SENSOR_METRICS: SensorMetric[] = [
  { measurement: "co2", label: "CO₂", unit: "ppm", icon: "co2" },
  { measurement: "temp", label: "Temperatura", unit: "°C", icon: "thermostat" },
  { measurement: "umi", label: "Umidade", unit: "%", icon: "humidity_percentage" },
];

export const KPI_METRICS = ["co2", "temp", "umi"];
