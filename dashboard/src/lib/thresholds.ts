import type { ThresholdResult } from "./types";

export function getThreshold(measurement: string, value: number): ThresholdResult {
  switch (measurement) {
    case "co2":
      if (value < 800) return { level: "success", label: "Excelente" };
      if (value <= 1000) return { level: "warning", label: "Moderado" };
      return { level: "danger", label: "Ruim" };
    case "temp":
      if (value >= 18 && value <= 26) return { level: "success", label: "Confortável" };
      if ((value >= 15 && value < 18) || (value > 26 && value <= 30)) return { level: "warning", label: "Atenção" };
      return { level: "danger", label: "Extremo" };
    case "umi":
      if (value >= 40 && value <= 60) return { level: "success", label: "Ideal" };
      if ((value >= 30 && value < 40) || (value > 60 && value <= 70)) return { level: "warning", label: "Atenção" };
      return { level: "danger", label: "Extremo" };
    default:
      return { level: "info", label: "" };
  }
}

export function thresholdColor(level: ThresholdResult["level"]): string {
  const map = { success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)", info: "var(--info)" };
  return map[level];
}
