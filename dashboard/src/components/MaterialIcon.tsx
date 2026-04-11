"use client";

interface MaterialIconProps {
  name: string;
  size?: number;
  color?: string;
  className?: string;
  fill?: boolean;
}

export default function MaterialIcon({
  name,
  size = 24,
  color,
  className = "",
  fill = false,
}: MaterialIconProps) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontSize: size,
        color,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
        lineHeight: 1,
        userSelect: "none",
      }}
    >
      {name}
    </span>
  );
}
