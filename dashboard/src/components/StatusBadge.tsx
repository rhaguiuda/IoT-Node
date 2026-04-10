"use client";

interface StatusBadgeProps {
  level: "success" | "warning" | "danger" | "info";
  label: string;
}

const LEVEL_VARS: Record<StatusBadgeProps["level"], string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
};

export default function StatusBadge({ level, label }: StatusBadgeProps) {
  if (!label) return null;

  const color = LEVEL_VARS[level];

  return (
    <span
      className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
        color,
      }}
    >
      {label}
    </span>
  );
}
