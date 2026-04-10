import type { ThresholdResult } from "./types";

export function getCo2Threshold(value: number): ThresholdResult {
  if (value < 800) return { level: "success", label: "Excelente" };
  if (value <= 1000) return { level: "warning", label: "Moderado" };
  return { level: "danger", label: "Ruim" };
}

export function getTempThreshold(value: number): ThresholdResult {
  if (value >= 18 && value <= 26) return { level: "success", label: "Confortável" };
  if ((value >= 15 && value < 18) || (value > 26 && value <= 30)) return { level: "warning", label: "Atenção" };
  return { level: "danger", label: "Extremo" };
}

export function getHumidityThreshold(value: number): ThresholdResult {
  if (value >= 40 && value <= 60) return { level: "success", label: "Ideal" };
  if ((value >= 30 && value < 40) || (value > 60 && value <= 70)) return { level: "warning", label: "Atenção" };
  return { level: "danger", label: "Extremo" };
}

export function getTvocThreshold(value: number): ThresholdResult {
  if (value < 250) return { level: "success", label: "Bom" };
  if (value <= 2000) return { level: "warning", label: "Moderado" };
  return { level: "danger", label: "Ruim" };
}

export function getAqiThreshold(value: number): ThresholdResult {
  if (value <= 2) return { level: "success", label: "Bom" };
  if (value <= 3) return { level: "warning", label: "Moderado" };
  return { level: "danger", label: "Ruim" };
}

export function getLuxThreshold(_value: number): ThresholdResult {
  return { level: "info", label: "" };
}

export function getThreshold(sensor: string, measurement: string, value: number): ThresholdResult {
  if (sensor === "scd41" && measurement === "co2") return getCo2Threshold(value);
  if (measurement === "temp") return getTempThreshold(value);
  if (measurement === "umi") return getHumidityThreshold(value);
  if (measurement === "tvoc") return getTvocThreshold(value);
  if (measurement === "airq") return getAqiThreshold(value);
  if (measurement === "lux") return getLuxThreshold(value);
  return { level: "info", label: "" };
}

export function thresholdColor(level: ThresholdResult["level"]): string {
  const map = { success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)", info: "var(--info)" };
  return map[level];
}
