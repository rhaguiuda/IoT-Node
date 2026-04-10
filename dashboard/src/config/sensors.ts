export const MQTT_BROKER_WS = "ws://192.168.100.224:8884/mqtt";
export const MQTT_TOPIC_PREFIX = "teras/iotnode/1/telemetry";

export interface SensorMetric {
  sensor: string;
  measurement: string;
  topic: string;
  label: string;
  unit: string;
  icon: string;
}

export const SENSOR_METRICS: SensorMetric[] = [
  { sensor: "scd41", measurement: "co2", topic: `${MQTT_TOPIC_PREFIX}/scd41/co2`, label: "CO₂", unit: "ppm", icon: "Wind" },
  { sensor: "scd41", measurement: "temp", topic: `${MQTT_TOPIC_PREFIX}/scd41/temp`, label: "Temp (SCD41)", unit: "°C", icon: "Thermometer" },
  { sensor: "scd41", measurement: "umi", topic: `${MQTT_TOPIC_PREFIX}/scd41/umi`, label: "Umidade (SCD41)", unit: "%", icon: "Droplets" },
  { sensor: "ens160", measurement: "eco2", topic: `${MQTT_TOPIC_PREFIX}/ens160/eco2`, label: "eCO₂", unit: "ppm", icon: "Factory" },
  { sensor: "ens160", measurement: "tvoc", topic: `${MQTT_TOPIC_PREFIX}/ens160/tvoc`, label: "TVOC", unit: "ppb", icon: "Factory" },
  { sensor: "ens160", measurement: "airq", topic: `${MQTT_TOPIC_PREFIX}/ens160/airq`, label: "AQI", unit: "", icon: "Wind" },
  { sensor: "sht4x", measurement: "temp", topic: `${MQTT_TOPIC_PREFIX}/sht4x/temp`, label: "Temperatura", unit: "°C", icon: "Thermometer" },
  { sensor: "sht4x", measurement: "umi", topic: `${MQTT_TOPIC_PREFIX}/sht4x/umi`, label: "Umidade", unit: "%", icon: "Droplets" },
  { sensor: "bh1750", measurement: "lux", topic: `${MQTT_TOPIC_PREFIX}/bh1750/lux`, label: "Luminosidade", unit: "lux", icon: "Sun" },
];

export const KPI_METRICS = [
  { sensor: "scd41", measurement: "co2" },
  { sensor: "sht4x", measurement: "temp" },
  { sensor: "sht4x", measurement: "umi" },
  { sensor: "ens160", measurement: "tvoc" },
  { sensor: "ens160", measurement: "airq" },
  { sensor: "bh1750", measurement: "lux" },
];
