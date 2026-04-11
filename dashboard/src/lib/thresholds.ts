import type { ThresholdResult } from "./types";

export function getThreshold(measurement: string, value: number): ThresholdResult {
  switch (measurement) {
    case "co2":
      if (value < 600) return { level: "success", label: "Excelente" };
      if (value < 800) return { level: "success", label: "Bom" };
      if (value < 1000) return { level: "success", label: "Aceitável" };
      if (value < 1200) return { level: "warning", label: "Alerta" };
      if (value < 1500) return { level: "danger", label: "Ruim" };
      if (value < 2000) return { level: "danger", label: "Muito Ruim" };
      if (value < 5000) return { level: "danger", label: "Péssimo" };
      return { level: "danger", label: "Perigo" };
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
